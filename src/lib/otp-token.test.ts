import { describe, expect, it } from "vitest";

import { normalizeEmailOtpToken } from "./otp-token";

describe("normalizeEmailOtpToken", () => {
  it("keeps only digits so users can paste spaced OTP codes", () => {
    expect(normalizeEmailOtpToken("123 456")).toBe("123456");
    expect(normalizeEmailOtpToken("1234-5678")).toBe("12345678");
  });

  it("accepts Supabase six or eight digit email OTP codes", () => {
    expect(normalizeEmailOtpToken("123456")).toBe("123456");
    expect(normalizeEmailOtpToken("12345678")).toBe("12345678");
  });

  it("returns null when the OTP code length is unsupported", () => {
    expect(normalizeEmailOtpToken("12345")).toBeNull();
    expect(normalizeEmailOtpToken("1234567")).toBeNull();
    expect(normalizeEmailOtpToken("abcdef")).toBeNull();
  });
});
