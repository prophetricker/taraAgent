import { describe, expect, it } from "vitest";

import {
  deriveBranchTopic,
  deriveTopicFromConversation,
  deriveTopicFromMessage
} from "./topic";

describe("deriveTopicFromMessage", () => {
  it("creates a compact title and readable summary from a user message", () => {
    const topic = deriveTopicFromMessage(
      "我想做一个保护早期灵感的 agent，它不要催我写 todo，而是先陪我把想法养大。"
    );

    expect(topic.title.length).toBeLessThanOrEqual(24);
    expect(topic.summary).toContain("保护早期灵感");
  });

  it("keeps an accumulating summary instead of replacing it with the latest sentence", () => {
    const topic = deriveTopicFromConversation({
      previousSummary: "我想做一个保护早期灵感的 agent。",
      latestMessage: "右侧画板中心应该沉淀我正在聊的主题，而不是只显示上一句话。"
    });

    expect(topic.summary).toContain("保护早期灵感");
    expect(topic.summary).toContain("右侧画板中心");
    expect(topic.summary).not.toBe("右侧画板中心应该沉淀我正在聊的主题，而不是只显示上一句话。");
  });

  it("falls back to the existing entrance topic for empty input", () => {
    expect(deriveTopicFromMessage("   ")).toEqual({
      title: "入口灵感",
      summary: "从这里开始倾倒、保护和深挖一个想法。"
    });
  });

  it("derives a branch topic from every two user messages", () => {
    const branch = deriveBranchTopic([
      "我想做一个右脑画布，中心展示当前主题。",
      "边缘可以暂时用卡片代表蒲公英碎片。"
    ]);

    expect(branch.title).toContain("右脑画布");
    expect(branch.summary).toContain("蒲公英碎片");
  });
});
