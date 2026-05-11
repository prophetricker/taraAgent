import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrations = readdirSync(join(process.cwd(), "supabase", "migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) =>
    readFileSync(join(process.cwd(), "supabase", "migrations", file), "utf8")
  )
  .join("\n");

describe("initial Supabase migration", () => {
  it("creates pgvector schema with RLS protected MVP tables", () => {
    expect(migrations).toContain("create extension if not exists vector");
    expect(migrations).toContain("create table if not exists public.inspiration_nodes");
    expect(migrations).toContain("vector vector(1536)");
    expect(migrations).toContain("create table if not exists public.dandelion_fragments");
    expect(migrations).toContain("create table if not exists public.conversations");
    expect(migrations).toContain("create table if not exists public.messages");
    expect(migrations).toContain("enable row level security");
    expect(migrations).toContain("auth.uid() = user_id");
    expect(migrations).toContain("create table if not exists public.idea_relations");
    expect(migrations).toContain("relation_kind text not null");
  });
});
