import { NextResponse } from "next/server";
import { z } from "zod";

import {
  assertDatabaseReady,
  DatabaseMigrationError,
  getDatabaseHealth,
  upsertIdeaRelation
} from "@/db/queries";
import { requireUser } from "@/lib/auth";
import {
  getRelationSaveFailureMessage,
  getRelationSaveFailureStatus
} from "@/lib/api-errors";

const relationKindSchema = z.enum([
  "derivation",
  "association",
  "support",
  "conflict",
  "analogy",
  "capture",
  "pending"
]);

const upsertRelationSchema = z.object({
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  relationKind: relationKindSchema
});

export async function PATCH(request: Request) {
  const user = await requireUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const input = upsertRelationSchema.parse(await request.json());
  let relation;

  try {
    assertDatabaseReady(await getDatabaseHealth());
    relation = await upsertIdeaRelation({
      userId: user.id,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      relationKind: input.relationKind
    });
  } catch (error) {
    if (error instanceof DatabaseMigrationError) {
      return NextResponse.json(
        {
          error: getRelationSaveFailureMessage({ code: "42P01" }),
          databaseHealth: error.health
        },
        { status: 503 }
      );
    }

    console.error("Failed to save idea relation", error);

    return NextResponse.json(
      { error: getRelationSaveFailureMessage(error) },
      { status: getRelationSaveFailureStatus(error) }
    );
  }

  if (!relation) {
    return NextResponse.json(
      { error: "Relation nodes not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ relation });
}
