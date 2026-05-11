import { describe, expect, it } from "vitest";

import {
  applyRelationSaveFailure,
  applyRelationOptimisticUpdate,
  getInitialCanvasNotice
} from "./workspace-state";

describe("getInitialCanvasNotice", () => {
  it("tells the user which migration is missing", () => {
    expect(
      getInitialCanvasNotice({
        ok: false,
        missingObjects: ["public.idea_relations"],
        requiredMigrations: ["supabase/migrations/0002_idea_relations.sql"]
      })
    ).toContain("0002_idea_relations.sql");
  });
});

describe("relation optimistic state", () => {
  it("rolls back to previous relations when the save fails", () => {
    const previousRelations = [
      {
        sourceNodeId: "source",
        targetNodeId: "target",
        relationKind: "derivation" as const
      }
    ];
    const optimistic = applyRelationOptimisticUpdate(previousRelations, {
      sourceNodeId: "source",
      targetNodeId: "target",
      relationKind: "conflict"
    });

    expect(optimistic[0].relationKind).toBe("conflict");
    expect(applyRelationSaveFailure(previousRelations)).toBe(previousRelations);
  });
});
