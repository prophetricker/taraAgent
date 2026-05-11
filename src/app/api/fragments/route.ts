import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getConversationForUser,
  getNodeForUser,
  createFragment,
  listFragments
} from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { findDuplicateFragment } from "@/lib/fragments";

const createFragmentSchema = z.object({
  nodeId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  content: z.string().min(1).max(80),
  originalContext: z.string().min(1).max(5000),
  sentimentVibe: z.string().max(80).nullable().optional()
});

export async function GET(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get("node_id");

  if (nodeId) {
    const node = await getNodeForUser({ userId: user.id, nodeId });

    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }
  }

  const fragments = await listFragments({
    userId: user.id,
    nodeId
  });

  return NextResponse.json({ fragments });
}

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const input = createFragmentSchema.parse(await request.json());

  if (input.nodeId) {
    const node = await getNodeForUser({
      userId: user.id,
      nodeId: input.nodeId
    });

    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }
  }

  if (input.conversationId) {
    const conversation = await getConversationForUser({
      userId: user.id,
      conversationId: input.conversationId,
      nodeId: input.nodeId
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
  }

  const existingFragments = await listFragments({
    userId: user.id,
    nodeId: input.nodeId
  });
  const duplicate = findDuplicateFragment(existingFragments, {
    content: input.content,
    originalContext: input.originalContext
  });

  if (duplicate) {
    return NextResponse.json({ fragment: duplicate });
  }

  const fragment = await createFragment({
    userId: user.id,
    nodeId: input.nodeId,
    conversationId: input.conversationId,
    content: input.content,
    originalContext: input.originalContext,
    sentimentVibe: input.sentimentVibe
  });

  return NextResponse.json({ fragment }, { status: 201 });
}
