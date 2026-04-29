import { describe, expect, it } from "vitest";

import { readServerEnv } from "./env";

describe("readServerEnv", () => {
  it("returns configured xlab settings with default base url", () => {
    const env = readServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      DATABASE_URL: "postgres://user:pass@host:5432/postgres",
      XLAB_API_KEY: "key",
      XLAB_CHAT_MODEL: "claude-sonnet"
    });

    expect(env.xlab.baseUrl).toBe("https://xlabapi.com/v1");
    expect(env.xlab.model).toBe("claude-sonnet");
  });

  it("lists missing required keys instead of silently continuing", () => {
    expect(() => readServerEnv({})).toThrow(
      "Missing required environment variables"
    );
  });
});
