import { NextResponse } from "next/server";
import { z } from "zod";

import { updateNodePosition } from "@/db/queries";
import { requireUser } from "@/lib/auth";

const updateNodePositionSchema = z.object({
  nodeId: z.string().uuid(),
  positionX: z.number().finite(),
  positionY: z.number().finite()
});

export async function PATCH(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const input = updateNodePositionSchema.parse(await request.json());
  const node = await updateNodePosition({
    userId: user.id,
    nodeId: input.nodeId,
    positionX: input.positionX,
    positionY: input.positionY
  });

  if (!node) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  return NextResponse.json({ node });
}
