import { describe, expect, it } from "vitest";

import { readServerEnv } from "./env";

describe("readServerEnv", () => {
  it("returns configured AI provider settings without a hardcoded base url", () => {
    const env = readServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      DATABASE_URL: "postgres://user:pass@host:5432/postgres",
      AI_API_KEY: "key",
      AI_BASE_URL: "https://example.com/v1",
      AI_CHAT_MODEL: "claude-sonnet"
    });

    expect(env.ai.baseUrl).toBe("https://example.com/v1");
    expect(env.ai.model).toBe("claude-sonnet");
  });

  it("lists missing required keys instead of silently continuing", () => {
    expect(() => readServerEnv({})).toThrow(
      "Missing required environment variables"
    );
  });
});
