import { describe, expect, it } from "vitest";

import { findDuplicateFragment, formatFragmentCopy } from "./fragments";

const baseFragment = {
  id: "fragment-1",
  nodeId: "node-1",
  conversationId: "conversation-1",
  content: "离线采集入口",
  originalContext: "另外我还想到一个离线采集入口，可以以后再展开。",
  sentimentVibe: "发散",
  createdAt: "2026-04-28T00:00:00.000Z"
};

describe("findDuplicateFragment", () => {
  it("matches existing fragments by normalized content or original context", () => {
    expect(
      findDuplicateFragment([baseFragment], {
        content: "  离线采集入口 ",
        originalContext: "新的上下文"
      })?.id
    ).toBe("fragment-1");

    expect(
      findDuplicateFragment([baseFragment], {
        content: "新的标题",
        originalContext: "另外我还想到一个离线采集入口，可以以后再展开。"
      })?.id
    ).toBe("fragment-1");
  });

  it("does not match different fragments", () => {
    expect(
      findDuplicateFragment([baseFragment], {
        content: "节点详情面板",
        originalContext: "点击历史节点时打开一个详情面板。"
      })
    ).toBeNull();
  });
});

describe("formatFragmentCopy", () => {
  it("cleans noisy fragment titles and keeps a readable context preview", () => {
    expect(
      formatFragmentCopy({
        content: "另外我还想到一个离线采集入口，可以以后再展开。",
        originalContext:
          "另外我还想到一个离线采集入口，可以以后再展开。它不是当前画布主线，但值得之后单独回看。",
        sentimentVibe: "发散"
      })
    ).toMatchObject({
      title: "离线采集入口",
      preview:
        "我还想到一个离线采集入口，可以以后再展开。它不是当前画布主线，但值得之后单独回看。"
    });
  });

  it("falls back to original context when the stored title is generic", () => {
    expect(
      formatFragmentCopy({
        content: "旁支想法",
        originalContext: "以后可以把蒲公英做成可聚合的边缘星群。",
        sentimentVibe: null
      }).title
    ).toBe("蒲公英做成可聚合的边缘星群");
  });
});
