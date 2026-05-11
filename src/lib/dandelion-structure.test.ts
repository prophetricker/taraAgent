import { describe, expect, it } from "vitest";

import {
  buildDandelionStructurePrompt,
  parseDandelionStructure
} from "./dandelion-structure";

describe("parseDandelionStructure", () => {
  it("accepts an evolving center and one well-formed extension", () => {
    const structure = parseDandelionStructure(
      JSON.stringify({
        center: {
          title: "学习路径的起点张力",
          summary:
            "这颗蒲公英从“怎样真正学会一件事”发起：它关心先抓住宏观方向，还是先钻入微观细节，以及两者如何互相支撑。"
        },
        extension: {
          title: "先宏观后微观",
          summary:
            "先用宏观框架确认目标和边界，再进入微观步骤，避免一开始就陷入碎片细节。",
          relationKind: "derivation"
        }
      })
    );

    expect(structure).toEqual({
      center: {
        title: "学习路径的起点张力",
        summary:
          "这颗蒲公英从“怎样真正学会一件事”发起：它关心先抓住宏观方向，还是先钻入微观细节，以及两者如何互相支撑。"
      },
      extension: {
        title: "先宏观后微观",
        summary:
          "先用宏观框架确认目标和边界，再进入微观步骤，避免一开始就陷入碎片细节。",
        relationKind: "derivation"
      }
    });
  });

  it("keeps optional relation hints for layout without requiring a new database column", () => {
    const structure = parseDandelionStructure(
      JSON.stringify({
        center: {
          title: "产品入口的起点",
          summary:
            "这颗蒲公英从新用户进入产品后不知道从哪里开始发起，关注入口引导和第一步操作之间的关系。"
        },
        extension: {
          title: "开场句引导",
          summary:
            "第一屏用明确开场句承接入口体验，让用户知道可以直接说出当前想法。",
          relationKind: "support",
          relatedToPreviousExtension: true
        }
      })
    );

    expect(structure?.extension).toMatchObject({
      title: "开场句引导",
      relationKind: "support",
      relatedToPreviousExtension: true
    });
  });


  it("rejects low-signal extension titles and copied summaries", () => {
    expect(
      parseDandelionStructure(
        JSON.stringify({
          center: {
            title: "学习路径",
            summary:
              "这颗蒲公英从学习路径的困惑发起，继续整理宏观方向与微观步骤之间的关系。"
          },
          extension: {
            title: "b和c都比较重要",
            summary: "b和c都比较重要。我认为这是学会的关键。",
            relationKind: "association"
          }
        }),
        {
          latestUserMessage: "b和c都比较重要。我认为这是学会的关键。"
        }
      )?.extension
    ).toBeNull();
  });

  it("rewrites meta-style extension summaries into a direct readable sentence", () => {
    const structure = parseDandelionStructure(
      JSON.stringify({
        center: {
          title: "先跑通的主线",
          summary:
            "这颗蒲公英从先跑通最小闭环开始，关注如何在第一阶段把主线压实并保留可见结果。"
        },
        extension: {
          title: "先跑通的最小MVP主线",
          summary:
            "补充了以“先启动跑通并获得可见结果”为第一阶段的教学策略：只让此刻必要的主线先被跑通。",
          relationKind: "derivation"
        }
      })
    );

    expect(structure?.extension?.summary).toBe(
      "把当前主线收束到“先跑通的最小MVP主线”这条分支，先保证最小闭环跑通。"
    );
  });

  it("builds a prompt that asks center to evolve and extension to stay mergeable", () => {
    const prompt = buildDandelionStructurePrompt({
      previousTitle: "入口灵感",
      previousSummary: "从这里开始倾倒、保护和深挖一个想法。",
      messages: [
        { role: "user", content: "我觉得学会要先宏观，再微观。" },
        { role: "assistant", content: "我先帮你守住这个区分。" },
        { role: "user", content: "宏观不是空话，而是知道要做什么。" }
      ]
    });

    expect(prompt).toContain("中心可以随着对话不断完善");
    expect(prompt).toContain("延伸是当前蒲公英内部节点");
    expect(prompt).toContain("relatedToPreviousExtension");
    expect(prompt).toContain("后续可能被语义合并");
    expect(prompt).toContain('"center"');
    expect(prompt).toContain('"extension"');
  });
});
