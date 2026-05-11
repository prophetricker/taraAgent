import { describe, expect, it } from "vitest";

import {
  buildDatabaseHealth,
  isMissingRelationTableError
} from "./database-health";

describe("buildDatabaseHealth", () => {
  it("reports the missing migration that would make relation saves fake", () => {
    expect(
      buildDatabaseHealth({
        "public.inspiration_nodes": true,
        "public.conversations": true,
        "public.messages": true,
        "public.dandelion_fragments": true,
        "public.idea_relations": false
      })
    ).toMatchObject({
      ok: false,
      missingObjects: ["public.idea_relations"],
      requiredMigrations: ["supabase/migrations/0002_idea_relations.sql"]
    });
  });

  it("passes only when all runtime tables are present", () => {
    expect(
      buildDatabaseHealth({
        "public.inspiration_nodes": true,
        "public.conversations": true,
        "public.messages": true,
        "public.dandelion_fragments": true,
        "public.idea_relations": true
      }).ok
    ).toBe(true);
  });
});

describe("isMissingRelationTableError", () => {
  it("detects Postgres missing relation errors", () => {
    expect(isMissingRelationTableError({ code: "42P01" })).toBe(true);
    expect(isMissingRelationTableError(new Error("boom"))).toBe(false);
  });
});
