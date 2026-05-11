import { describe, expect, it } from "vitest";

import {
  getRelationSaveFailureMessage,
  getUserSafeChatStreamError
} from "./api-errors";

describe("getUserSafeChatStreamError", () => {
  it("does not expose provider or server error messages to the chat UI", () => {
    expect(getUserSafeChatStreamError(new Error("Instructions are required"))).toBe(
      "模型暂时没有回应，请稍后重试。"
    );
  });
});

describe("getRelationSaveFailureMessage", () => {
  it("turns missing relation table errors into an actionable migration message", () => {
    expect(getRelationSaveFailureMessage({ code: "42P01" })).toContain(
      "0002_idea_relations.sql"
    );
  });
});
