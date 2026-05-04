import { describe, expect, it } from "vitest";

import {
  buildDandelionSummaryPrompt,
  parseDandelionSummary
} from "./dandelion-summarizer";

describe("parseDandelionSummary", () => {
  it("accepts a grounded dandelion center summary", () => {
    const summary = parseDandelionSummary(
      JSON.stringify({
        title: "右脑画布的可读性",
        summary:
          "这颗蒲公英围绕右侧画布如何被读懂展开：中心要抓住主干并持续更新，延伸要表达分支关系，连线和布局要减少遮挡与交叉。"
      })
    );

    expect(summary).toEqual({
      title: "右脑画布的可读性",
      summary:
        "这颗蒲公英围绕右侧画布如何被读懂展开：中心要抓住主干并持续更新，延伸要表达分支关系，连线和布局要减少遮挡与交叉。"
    });
  });

  it("rejects empty or sentence-copy summaries", () => {
    expect(
      parseDandelionSummary(
        JSON.stringify({
          title: "",
          summary: "右侧画布的中心应该沉淀我正在聊的主题。"
        }),
        {
          latestUserMessage: "右侧画布的中心应该沉淀我正在聊的主题。"
        }
      )
    ).toBeNull();
  });

  it("builds a prompt that asks for main-thread synthesis from conversation history", () => {
    const prompt = buildDandelionSummaryPrompt({
      previousTitle: "入口灵感",
      previousSummary: "从这里开始倾倒、保护和深挖一个想法。",
      messages: [
        { role: "user", content: "中心要抓主干。" },
        { role: "assistant", content: "我先帮你守住这个方向。" },
        { role: "user", content: "连线也不能遮挡延伸块。" }
      ]
    });

    expect(prompt).toContain("通读当前对话");
    expect(prompt).toContain("起点");
    expect(prompt).toContain("树根");
    expect(prompt).toContain("发起原因");
    expect(prompt).toContain("连线也不能遮挡延伸块");
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"summary"');
  });
});
