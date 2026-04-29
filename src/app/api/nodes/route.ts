import { NextResponse } from "next/server";
import { z } from "zod";

import { createNode, ensureDefaultNode, listNodes, updateNode } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { toFlowGraph } from "@/lib/graph";

const createNodeSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(120),
  content: z.string().max(4000).default(""),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional()
});

const updateNodeSchema = z.object({
  nodeId: z.string().uuid(),
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(4000)
});

export async function GET() {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDefaultNode(user.id);
  const nodes = await listNodes(user.id);

  return NextResponse.json(toFlowGraph(nodes));
}

export async function POST(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const input = createNodeSchema.parse(await request.json());
  const node = await createNode({
    userId: user.id,
    parentId: input.parentId,
    title: input.title,
    content: input.content,
    positionX: input.positionX,
    positionY: input.positionY
  });

  return NextResponse.json(node, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const input = updateNodeSchema.parse(await request.json());
  const node = await updateNode({
    userId: user.id,
    nodeId: input.nodeId,
    title: input.title,
    content: input.content
  });

  if (!node) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  return NextResponse.json({ node });
}
