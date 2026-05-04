import { describe, expect, it } from "vitest";

import { formatIdeaNodeCopy } from "./idea-copy";

describe("formatIdeaNodeCopy", () => {
  it("gives dandelion centers a broader contextual title and longer explanation", () => {
    const copy = formatIdeaNodeCopy({
      role: "dandelion",
      title: "节点标题质量",
      content:
        "这颗蒲公英在讨论右侧蒲公英图的可读性：中心需要解释整颗蒲公英，延伸节点要有高质量标题，连线要有节奏并避开延伸块。"
    });

    expect(copy.displayTitle).toBe("蒲公英图的文案与连线体验");
    expect(copy.summary).toBe(
      "这颗蒲公英关注右侧画布如何被读懂：中心负责解释整体主题，延伸用高质量标题承载分支，连线用有节奏的路径表达关系。"
    );
    expect(copy.summary.length).toBeGreaterThan(50);
  });

  it("creates compact display copy without echoing the full original sentence", () => {
    const copy = formatIdeaNodeCopy({
      title: "我觉得右侧画板现在太乱了",
      content:
        "我觉得右侧画板现在太乱了，蒲公英中心到各个延伸块的连线都起始于一个点，导致线压在块下面，阅读体验很差。"
    });

    expect(copy.displayTitle).toBe("画布连线可读性");
    expect(copy.summary).toBe("关注画布连线和块的排版可读性。");
    expect(copy.summary).not.toBe(copy.displayTitle);
    expect(copy.tags).toContain("画布");
    expect(copy.tags).toContain("关系线");
  });

  it("extracts multiple tags that can be used for hover highlighting", () => {
    const copy = formatIdeaNodeCopy({
      title: "碎片相关度",
      content:
        "碎片和当前主题相关度大就离中心近，相关度小就离得远，碎片之间有关联也可以离得近。"
    });

    expect(copy.tags).toEqual(
      expect.arrayContaining(["碎片", "相关度", "布局"])
    );
  });

  it("summarizes extension relationships instead of copying the source sentence", () => {
    const copy = formatIdeaNodeCopy({
      title: "延伸之间也要能互相连接",
      content:
        "延伸也是有层次的，也可能交叉相关联，关系线可以表达由此推导、由此联想或者互相冲突。"
    });

    expect(copy.displayTitle).toBe("延伸关系网络");
    expect(copy.summary).toBe("用关系线表达延伸之间的逻辑生长。");
    expect(copy.summary).not.toContain("也是有层次");
    expect(copy.tags).toEqual(
      expect.arrayContaining(["延伸", "关系线", "相关度"])
    );
  });

  it("uses context to create a standalone title for automatic fragment boundaries", () => {
    const copy = formatIdeaNodeCopy({
      title: "这个功能有待商榷",
      content:
        "自动蒲公英不能做成固定触发的逻辑，哪怕是不生成，也不能泛滥地生成碎片。"
    });

    expect(copy.displayTitle).toBe("碎片自动生成边界");
    expect(copy.summary).toBe("自动碎片宁缺毋滥，避免固定触发泛滥。");
  });

  it("rewrites dangling temporal clauses into readable product titles", () => {
    const copy = formatIdeaNodeCopy({
      title: "当思维乱了",
      content:
        "当思维乱了，可能需要一阵风吹动蒲公英旋转方向，让 AI 帮你换个视角。"
    });

    expect(copy.displayTitle).toBe("一阵风换视角");
    expect(copy.summary).toBe("在思维变乱时切换观察角度。");
    expect(copy.displayTitle).not.toContain("当");
  });

  it("names node copy quality issues directly instead of using a raw sentence", () => {
    const copy = formatIdeaNodeCopy({
      title: "节点的标题是最需要好好生成的",
      content:
        "节点的标题是用户主要看到的东西，需要参考上下文归纳，不能单独看都语句不通。"
    });

    expect(copy.displayTitle).toBe("节点标题质量");
    expect(copy.summary).toBe("标题和简介需要结合上下文，保证单独可读。");
    expect(copy.tags).toContain("文案");
  });

  it("rewrites low-signal sentence titles into a contextual principle", () => {
    const copy = formatIdeaNodeCopy({
      title: "b和c都比较重要",
      content:
        "b和c都比较重要。我认为这是学会的关键。先宏观，再微观，先知道要做什么。"
    });

    expect(copy.displayTitle).toBe("先宏观后微观");
    expect(copy.summary).toBe("学会的关键是先从宏观把握方向，再往微观推进。");
  });
});
