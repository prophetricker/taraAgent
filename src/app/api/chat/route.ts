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
  listFragments,
  listMessages,
  listNodes,
  updateNode,
  upsertNodeByTitle
} from "@/db/queries";
import { requireUser } from "@/lib/auth";
import {
  buildDandelionExtractionPrompt,
  parseDandelionDecision,
  shouldAttemptDandelionExtraction
} from "@/lib/dandelion-extractor";
import { readServerEnv } from "@/lib/env";
import { findDuplicateFragment } from "@/lib/fragments";
import { getTextFromParts } from "@/lib/messages";
import { buildGuardianSystemPrompt, type GuardianMode } from "@/lib/prompt";
import { deriveBranchTopic, deriveTopicFromConversation } from "@/lib/topic";

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
  const env = readServerEnv();
  const xlab = createOpenAICompatible({
    name: "xlab",
    apiKey: env.xlab.apiKey,
    baseURL: env.xlab.baseUrl
  });
  const conversation = parsed.conversationId
    ? { id: parsed.conversationId }
    : await ensureConversation({ userId: user.id, nodeId: parsed.nodeId });
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
      const history = await listMessages({
        userId: user.id,
        conversationId: conversation.id
      });
      const userMessageCount = history.filter(
        (message) => message.role === "user"
      ).length;
      const activeNode = (await listNodes(user.id)).find(
        (node) => node.id === parsed.nodeId
      );
      const topic = deriveTopicFromConversation({
        previousSummary: activeNode?.content ?? "",
        latestMessage: content
      });
      await updateNode({
        userId: user.id,
        nodeId: parsed.nodeId,
        title: topic.title,
        content: topic.summary
      });
      if (userMessageCount > 1 && userMessageCount % 2 === 0) {
        const recentUserMessages = history
          .filter((message) => message.role === "user")
          .slice(-2)
          .map((message) => message.content);
        const branch = deriveBranchTopic(recentUserMessages);

        await upsertNodeByTitle({
          userId: user.id,
          parentId: parsed.nodeId,
          title: branch.title,
          content: branch.summary,
          positionX: 340 + userMessageCount * 36,
          positionY: 120 + (userMessageCount % 4) * 90
        });
      }
    }
  }

  const result = streamText({
    model: xlab.chatModel(env.xlab.model),
    system: buildGuardianSystemPrompt(parsed.mode as GuardianMode),
    messages: await convertToModelMessages(parsed.messages),
    onFinish: async ({ text }) => {
      if (text) {
        await createMessage({
          userId: user.id,
          conversationId: conversation.id,
          role: "assistant",
          content: text
        });
      }
      if (latestUserMessage) {
        const content = getTextFromParts(latestUserMessage);
        const activeNode = (await listNodes(user.id)).find(
          (node) => node.id === parsed.nodeId
        );

        await maybeCreateDandelionFragment({
          model: xlab.chatModel(env.xlab.model),
          userId: user.id,
          nodeId: parsed.nodeId,
          conversationId: conversation.id,
          currentTopic: activeNode?.content ?? "",
          userMessage: content
        });
      }
    }
  });

  return result.toUIMessageStreamResponse({
    onError(error) {
      if (error instanceof Error) {
        return error.message;
      }

      return "Agent stream failed.";
    }
  });
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
