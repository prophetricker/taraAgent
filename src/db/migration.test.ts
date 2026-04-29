import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "0001_initial_schema.sql"),
  "utf8"
);

describe("initial Supabase migration", () => {
  it("creates pgvector schema with RLS protected MVP tables", () => {
    expect(migration).toContain("create extension if not exists vector");
    expect(migration).toContain("create table if not exists public.inspiration_nodes");
    expect(migration).toContain("vector vector(1536)");
    expect(migration).toContain("create table if not exists public.dandelion_fragments");
    expect(migration).toContain("create table if not exists public.conversations");
    expect(migration).toContain("create table if not exists public.messages");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("auth.uid() = user_id");
  });
});
