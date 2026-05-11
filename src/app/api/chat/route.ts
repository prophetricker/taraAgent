import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  generateText,
  streamText,
  type UIMessage
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createFragment,
  createMessage,
  ensureConversation,
  getConversationForUser,
  getNodeForUser,
  listFragments,
  listMessages,
  listNodes,
  updateNode,
  upsertIdeaRelation,
  upsertNodeByTitle
} from "@/db/queries";
import { requireUser } from "@/lib/auth";
import {
  buildDandelionExtractionPrompt,
  parseDandelionDecision,
  shouldAttemptDandelionExtraction
} from "@/lib/dandelion-extractor";
import {
  buildDandelionStructurePrompt,
  parseDandelionStructure
} from "@/lib/dandelion-structure";
import { readServerEnv } from "@/lib/env";
import { findDuplicateFragment } from "@/lib/fragments";
import type { IdeaRelationKind } from "@/lib/graph";
import { getTextFromParts } from "@/lib/messages";
import { buildGuardianSystemPrompt, type GuardianMode } from "@/lib/prompt";
import { deriveTopicFromConversation } from "@/lib/topic";
import { getChatSideEffectPlan } from "@/lib/chat-side-effects";
import { getUserSafeChatStreamError } from "@/lib/api-errors";

const chatRequestSchema = z.object({
  messages: z.array(z.custom<UIMessage>()),
  nodeId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  mode: z.enum(["listener", "socrates"]).default("listener")
});

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = chatRequestSchema.parse(await request.json());
  const activeNode = await getNodeForUser({
    userId: user.id,
    nodeId: parsed.nodeId
  });

  if (!activeNode) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const env = readServerEnv();
  const aiProvider = createOpenAICompatible({
    name: "ai-provider",
    apiKey: env.ai.apiKey,
    baseURL: env.ai.baseUrl
  });
  const conversation = parsed.conversationId
    ? await getConversationForUser({
        userId: user.id,
        conversationId: parsed.conversationId,
        nodeId: parsed.nodeId
      })
    : await ensureConversation({ userId: user.id, nodeId: parsed.nodeId });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const latestUserMessage = [...parsed.messages]
    .reverse()
    .find((message) => message.role === "user");

  if (latestUserMessage) {
    const content = getTextFromParts(latestUserMessage);
    if (content) {
      await createMessage({
        userId: user.id,
        conversationId: conversation.id,
        role: "user",
        content
      });
    }
  }

  const result = streamText({
    model: aiProvider.chatModel(env.ai.model),
    system: buildGuardianSystemPrompt(parsed.mode as GuardianMode),
    messages: await convertToModelMessages(parsed.messages),
    timeout: 30000,
    maxRetries: 1,
    onFinish: async ({ text }) => {
      let assistantSaved = false;

      if (text) {
        await createMessage({
          userId: user.id,
          conversationId: conversation.id,
          role: "assistant",
          content: text
        });
        assistantSaved = true;
      }
      if (latestUserMessage) {
        const content = getTextFromParts(latestUserMessage);
        const history = await listMessages({
          userId: user.id,
          conversationId: conversation.id
        });
        const userMessageCount = history.filter(
          (message) => message.role === "user"
        ).length;
        const sideEffectPlan = getChatSideEffectPlan({
          userMessageCount,
          userMessage: content,
          providerFailed: !assistantSaved
        });

        if (sideEffectPlan.updateDandelionCenter) {
          await updateDandelionStructure({
            model: aiProvider.chatModel(env.ai.model),
            userId: user.id,
            nodeId: parsed.nodeId,
            previousTitle: activeNode.title,
            previousSummary: activeNode.content,
            latestUserMessage: content,
            userMessageCount,
            messages: history
          });
        } else if (sideEffectPlan.attemptFragmentExtraction) {
          await maybeCreateDandelionFragment({
            model: aiProvider.chatModel(env.ai.model),
            userId: user.id,
            nodeId: parsed.nodeId,
            conversationId: conversation.id,
            currentTopic: activeNode.content,
            userMessage: content
          });
        }
      }
    }
  });

  return result.toUIMessageStreamResponse({
    onError(error) {
      console.error("Chat stream failed", error);
      return getUserSafeChatStreamError(error);
    }
  });
}

async function updateDandelionStructure(input: {
  model: ReturnType<ReturnType<typeof createOpenAICompatible>["chatModel"]>;
  userId: string;
  nodeId: string;
  previousTitle: string;
  previousSummary: string;
  latestUserMessage: string;
  userMessageCount: number;
  messages: Array<{
    role: "user" | "assistant" | "system" | "tool";
    content: string;
  }>;
}) {
  const fallbackTopic = deriveTopicFromConversation({
    previousSummary: input.previousSummary,
    latestMessage: input.latestUserMessage
  });

  try {
    const result = await generateText({
      model: input.model,
      system:
        "你是一个蒲公英图结构整理器。你只输出 JSON。中心要持续完善，延伸要可读、可合并、可校正。",
      prompt: buildDandelionStructurePrompt({
        previousTitle: input.previousTitle,
        previousSummary: input.previousSummary,
        messages: input.messages
      }),
      temperature: 0.1
    });
    const structure = parseDandelionStructure(result.text, {
      latestUserMessage: input.latestUserMessage
    });
    const center = structure?.center ?? fallbackTopic;

    await updateNode({
      userId: input.userId,
      nodeId: input.nodeId,
      title: center.title,
      content: center.summary
    });
    if (structure?.extension) {
      await createStructuredExtension({
        userId: input.userId,
        parentId: input.nodeId,
        userMessageCount: input.userMessageCount,
        title: structure.extension.title,
        summary: structure.extension.summary,
        relationKind: structure.extension.relationKind,
        relatedToPreviousExtension: structure.extension.relatedToPreviousExtension,
        centerStrength: structure.extension.centerStrength,
        extensionStrength: structure.extension.extensionStrength
      });
    }
  } catch {
    await updateNode({
      userId: input.userId,
      nodeId: input.nodeId,
      title: fallbackTopic.title,
      content: fallbackTopic.summary
    });
  }
}

async function createStructuredExtension(input: {
  userId: string;
  parentId: string;
  userMessageCount: number;
  title: string;
  summary: string;
  relationKind: Exclude<IdeaRelationKind, "capture">;
  relatedToPreviousExtension?: boolean;
  centerStrength?: number;
  extensionStrength?: number;
}) {
  const node = await upsertNodeByTitle({
    userId: input.userId,
    parentId: input.parentId,
    title: input.title,
    content: input.summary,
    positionX: 340 + input.userMessageCount * 36,
    positionY: 120 + (input.userMessageCount % 4) * 90
  });

  try {
    await upsertIdeaRelation({
      userId: input.userId,
      sourceNodeId: input.parentId,
      targetNodeId: node.id,
      relationKind: input.relationKind
    });

    if (input.relatedToPreviousExtension) {
      const previousExtension = await getPreviousExtensionForParent({
        userId: input.userId,
        parentId: input.parentId,
        excludeNodeId: node.id
      });

      if (previousExtension) {
        await upsertIdeaRelation({
          userId: input.userId,
          sourceNodeId: previousExtension.id,
          targetNodeId: node.id,
          relationKind: input.relationKind
        });
      }
    }
  } catch (error) {
    console.error("Failed to save structured extension relation", error);
  }

  return node;
}

async function getPreviousExtensionForParent(input: {
  userId: string;
  parentId: string;
  excludeNodeId: string;
}) {
  const nodes = await listNodes(input.userId);
  const candidates = nodes.filter(
    (node) =>
      node.parentId === input.parentId && node.id !== input.excludeNodeId
  );

  return candidates.at(-1) ?? null;
}

async function maybeCreateDandelionFragment(input: {
  model: ReturnType<ReturnType<typeof createOpenAICompatible>["chatModel"]>;
  userId: string;
  nodeId: string;
  conversationId: string;
  currentTopic: string;
  userMessage: string;
}) {
  if (!input.userMessage.trim()) {
    return;
  }

  if (!shouldAttemptDandelionExtraction(input.userMessage)) {
    return;
  }

  try {
    const result = await generateText({
      model: input.model,
      system:
        "你是一个极其克制的灵感旁支判定器。你只输出 JSON。不能确定就拒绝保存。",
      prompt: buildDandelionExtractionPrompt({
        currentTopic: input.currentTopic,
        userMessage: input.userMessage
      }),
      temperature: 0
    });
    const decision = parseDandelionDecision(result.text, {
      sourceText: input.userMessage
    });

    if (!decision) {
      return;
    }

    const existingFragments = await listFragments({
      userId: input.userId,
      nodeId: input.nodeId
    });
    const alreadyExists = findDuplicateFragment(existingFragments, {
      content: decision.content,
      originalContext: decision.originalContext
    });

    if (alreadyExists) {
      return;
    }

    await createFragment({
      userId: input.userId,
      nodeId: input.nodeId,
      conversationId: input.conversationId,
      content: decision.content,
      originalContext: decision.originalContext,
      sentimentVibe: decision.sentimentVibe
    });
  } catch {
    // Automatic capture must never break the main conversation.
  }
}
