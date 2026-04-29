import { describe, expect, it } from "vitest";

import {
  parseDandelionDecision,
  shouldAttemptDandelionExtraction
} from "./dandelion-extractor";

describe("parseDandelionDecision", () => {
  it("accepts a high-confidence side idea decision", () => {
    expect(
      parseDandelionDecision(
        JSON.stringify({
          should_capture: true,
          confidence: 0.96,
          content: "离线采集入口",
          original_context: "另外我还想到一个离线采集入口，可以以后再展开。",
          sentiment_vibe: "发散"
        })
      )
    ).toMatchObject({
      content: "离线采集入口",
      originalContext: "另外我还想到一个离线采集入口，可以以后再展开。",
      sentimentVibe: "发散"
    });
  });

  it("rejects low-confidence or non-capture decisions", () => {
    expect(
      parseDandelionDecision(
        JSON.stringify({
          should_capture: true,
          confidence: 0.7,
          content: "不够确定",
          original_context: "这可能只是主线的一部分。"
        })
      )
    ).toBeNull();
    expect(
      parseDandelionDecision(
        JSON.stringify({
          should_capture: false,
          confidence: 0.95,
          content: "",
          original_context: ""
        })
      )
    ).toBeNull();
  });

  it("rejects capture decisions that are not grounded in the user message", () => {
    expect(
      parseDandelionDecision(
        JSON.stringify({
          should_capture: true,
          confidence: 0.96,
          content: "离线采集入口",
          original_context: "用户没有说过的离线采集入口",
          sentiment_vibe: "发散"
        }),
        {
          sourceText: "我现在只想继续聊右侧画布的中心主题。"
        }
      )
    ).toBeNull();
  });

  it("only attempts automatic extraction for substantial user messages", () => {
    expect(shouldAttemptDandelionExtraction("另外想做离线采集")).toBe(false);
    expect(
      shouldAttemptDandelionExtraction(
        "我现在主要在聊右侧画布的中心主题，它应该持续沉淀当前对话的核心，而不是只复制上一句话。与此同时我脑子里还闪过一个以后再做的离线采集入口，但它现在不该打断这条主线。"
      )
    ).toBe(true);
  });

  it("parses JSON fenced by markdown and trims long summaries", () => {
    const decision = parseDandelionDecision(`\`\`\`json
{
  "should_capture": true,
  "confidence": 0.96,
  "content": "这是一个非常非常非常非常非常长的标题",
  "original_context": "旁支想法"
}
\`\`\``);

    expect(decision?.content.length).toBeLessThanOrEqual(30);
    expect(decision?.originalContext).toBe("旁支想法");
  });
});
