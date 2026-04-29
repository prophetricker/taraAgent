import { NextResponse } from "next/server";
import { z } from "zod";

import { createFragment, listFragments } from "@/db/queries";
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
  const fragments = await listFragments({
    userId: user.id,
    nodeId: searchParams.get("node_id")
  });

  return NextResponse.json({ fragments });
}

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const input = createFragmentSchema.parse(await request.json());
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
