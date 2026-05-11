import { describe, expect, it } from "vitest";

import {
  getNewDandelionDraft,
  getWorkspaceNodeHref
} from "./workspace-navigation";

describe("workspace navigation", () => {
  it("builds the URL for opening a dedicated dandelion canvas", () => {
    expect(getWorkspaceNodeHref("node-123")).toBe("/workspace?node_id=node-123");
  });

  it("creates stable copy for a blank new dandelion", () => {
    expect(getNewDandelionDraft()).toEqual({
      title: "新的蒲公英",
      content: "从这里开始倾倒一个新的想法。"
    });
  });
});
