import { describe, expect, it } from "vitest";

import { getAuthRedirectOrigin } from "./auth-url";

describe("getAuthRedirectOrigin", () => {
  it("prefers request origin for local auth redirects", () => {
    expect(
      getAuthRedirectOrigin({
        requestOrigin: "http://localhost:3000",
        siteUrl: "https://example.com"
      })
    ).toBe("http://localhost:3000");
  });

  it("falls back to configured site url and trims trailing slashes", () => {
    expect(
      getAuthRedirectOrigin({
        requestOrigin: null,
        siteUrl: "http://localhost:3000/"
      })
    ).toBe("http://localhost:3000");
  });
});
