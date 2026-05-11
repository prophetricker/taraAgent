import { describe, expect, it } from "vitest";

import {
  buildRightBrainGraph,
  getRelationVisualStyle,
  toFlowGraph
} from "./graph";

describe("toFlowGraph", () => {
  it("maps inspiration nodes to positioned React Flow nodes and parent edges", () => {
    const graph = toFlowGraph([
      {
        id: "root",
        parentId: null,
        title: "入口灵感",
        content: "一粒种子",
        positionX: 10,
        positionY: 20,
        createdAt: "2026-04-27T00:00:00.000Z",
        updatedAt: "2026-04-27T00:00:00.000Z"
      },
      {
        id: "child",
        parentId: "root",
        title: "旁支",
        content: "延伸想法",
        positionX: 180,
        positionY: 90,
        createdAt: "2026-04-27T00:00:00.000Z",
        updatedAt: "2026-04-27T00:00:00.000Z"
      }
    ]);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0]).toMatchObject({
      id: "root",
      position: { x: 10, y: 20 },
      data: {
        title: "入口灵感",
        content: "一粒种子",
        displayTitle: "入口灵感",
        summary: "一粒种子。",
        visualSize: "compact",
        isCurrent: true,
        kind: "dandelion"
      }
    });
    expect(graph.nodes[1]).toMatchObject({
      id: "child",
      data: {
        title: "旁支",
        content: "延伸想法",
        displayTitle: "旁支",
        summary: "记录中心想法继续长出的方向。",
        visualSize: "compact",
        isCurrent: false,
        kind: "extension"
      }
    });
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      id: "root-child",
      source: "root",
      target: "child",
      animated: true,
      type: "floating",
      zIndex: 2,
      label: "推导",
      data: {
        relationKind: "derivation"
      }
    });
  });
});

describe("buildRightBrainGraph", () => {
  it("adds captured fragment nodes without connecting them to the dandelion", () => {
    const graph = toFlowGraph([
      {
        id: "root",
        parentId: null,
        title: "入口灵感",
        content: "一粒种子",
        positionX: 10,
        positionY: 20,
        createdAt: "2026-04-27T00:00:00.000Z",
        updatedAt: "2026-04-27T00:00:00.000Z"
      }
    ]);
    const withFragments = buildRightBrainGraph({
      graph,
      activeNodeId: "root",
      fragments: [
        {
          id: "fragment-1",
          content: "离线采集入口",
          originalContext: "另外我还想到一个离线采集入口。",
          sentimentVibe: "发散",
          createdAt: "2026-04-28T00:00:00.000Z"
        }
      ]
    });

    expect(withFragments.nodes).toHaveLength(2);
    expect(withFragments.nodes[1]).toMatchObject({
      id: "fragment-fragment-1",
      type: "fragment",
      draggable: false,
      data: {
        title: "离线采集入口",
        content: "我还想到一个离线采集入口。",
        displayTitle: "离线采集入口",
        summary: "我还想到一个离线采集入口。",
        kind: "fragment",
        sourceTitle: "入口灵感"
      }
    });
    expect(withFragments.edges).toHaveLength(0);
  });

  it("keeps the active topic as the layout anchor and shows all extensions with age tones", () => {
    const records = Array.from({ length: 8 }, (_, index) => ({
      id: index === 0 ? "root" : `child-${index}`,
      parentId: index === 0 ? null : "root",
      title: index === 0 ? "入口灵感" : `历史主题 ${index}`,
      content: "延伸想法",
      positionX: 900 + index * 50,
      positionY: 800 + index * 50,
      createdAt: `2026-04-27T00:00:0${Math.min(index, 9)}.000Z`,
      updatedAt: `2026-04-27T00:00:0${Math.min(index, 9)}.000Z`
    }));
    const graph = buildRightBrainGraph({
      graph: toFlowGraph(records),
      activeNodeId: "root",
      fragments: [],
      maxExtensions: 7
    });

    expect(graph.nodes).toHaveLength(8);
    expect(graph.nodes[0]).toMatchObject({
      id: "root",
      position: { x: 900, y: 800 },
      data: { isCurrent: true }
    });
    expect(graph.nodes.slice(1).every((node) => !node.data.isCurrent)).toBe(
      true
    );
    expect(graph.nodes[1].data.ageTone).toBe("old");
    expect(graph.nodes.at(-1)?.data.ageTone).toBe("new");
  });

  it("does not mix unrelated root dandelions into the active dandelion graph", () => {
    const graph = buildRightBrainGraph({
      graph: toFlowGraph([
        {
          id: "active-root",
          parentId: null,
          title: "当前蒲公英",
          content: "当前中心",
          positionX: 0,
          positionY: 0,
          createdAt: "2026-04-27T00:00:00.000Z",
          updatedAt: "2026-04-27T00:00:00.000Z"
        },
        {
          id: "active-extension",
          parentId: "active-root",
          title: "当前延伸",
          content: "当前蒲公英内部的延伸",
          positionX: 0,
          positionY: 0,
          createdAt: "2026-04-27T00:00:01.000Z",
          updatedAt: "2026-04-27T00:00:01.000Z"
        },
        {
          id: "unrelated-root",
          parentId: null,
          title: "另一个蒲公英",
          content: "不应混进当前画布",
          positionX: 0,
          positionY: 0,
          createdAt: "2026-04-27T00:00:02.000Z",
          updatedAt: "2026-04-27T00:00:02.000Z"
        }
      ]),
      activeNodeId: "active-root",
      fragments: []
    });

    expect(graph.nodes.map((node) => node.id)).toEqual([
      "active-root",
      "active-extension"
    ]);
    expect(graph.edges).toHaveLength(1);
  });

  it("places newer extensions farther away than older supporting extensions", () => {
    const graph = buildRightBrainGraph({
      graph: toFlowGraph([
        {
          id: "root",
          parentId: null,
          title: "当前蒲公英",
          content: "中心",
          positionX: 0,
          positionY: 0,
          createdAt: "2026-04-27T00:00:00.000Z",
          updatedAt: "2026-04-27T00:00:00.000Z"
        },
        {
          id: "old-extension",
          parentId: "root",
          title: "旧支撑",
          content: "旧想法支撑新想法",
          positionX: 0,
          positionY: 0,
          createdAt: "2026-04-27T00:00:01.000Z",
          updatedAt: "2026-04-27T00:00:01.000Z"
        },
        {
          id: "new-extension",
          parentId: "root",
          title: "新生长",
          content: "新想法向外生长",
          positionX: 0,
          positionY: 0,
          createdAt: "2026-04-27T00:00:09.000Z",
          updatedAt: "2026-04-27T00:00:09.000Z"
        }
      ]),
      activeNodeId: "root",
      fragments: []
    });
    const oldExtension = graph.nodes.find((node) => node.id === "old-extension")!;
    const newExtension = graph.nodes.find((node) => node.id === "new-extension")!;
    const distance = (node: typeof oldExtension) =>
      Math.hypot(
        node.position.x + getNodeWidth(node) / 2 - 184,
        node.position.y + getNodeHeight(node) / 2 - 110
      );

    expect(distance(newExtension)).toBeGreaterThan(distance(oldExtension));
    expect(oldExtension.data.ageTone).toBe("old");
    expect(newExtension.data.ageTone).toBe("new");
  });

  it("marks text-heavy extensions as wider nodes so summaries can stay visible", () => {
    const graph = toFlowGraph([
      {
        id: "root",
        parentId: null,
        title: "当前蒲公英",
        content: "中心",
        positionX: 0,
        positionY: 0,
        createdAt: "2026-04-27T00:00:00.000Z",
        updatedAt: "2026-04-27T00:00:00.000Z"
      },
      {
        id: "copy-quality",
        parentId: "root",
        title: "节点的标题是最需要好好生成的",
        content:
          "节点的标题是用户主要看到的东西，需要参考上下文归纳，不能单独看都语句不通。",
        positionX: 0,
        positionY: 0,
        createdAt: "2026-04-27T00:00:01.000Z",
        updatedAt: "2026-04-27T00:00:01.000Z"
      }
    ]);

    expect(graph.nodes[1].data).toMatchObject({
      displayTitle: "节点标题质量",
      summary: "标题和简介需要结合上下文，保证单独可读。",
      visualSize: "wide"
    });
  });

  it("keeps many extensions readable by spreading their estimated bounds apart", () => {
    const records = Array.from({ length: 10 }, (_, index) => ({
      id: index === 0 ? "root" : `extension-${index}`,
      parentId: index === 0 ? null : "root",
      title: index === 0 ? "当前蒲公英" : `延伸 ${index}`,
      content: "画布排版需要避免延伸互相重叠。",
      positionX: 0,
      positionY: 0,
      createdAt: `2026-04-27T00:00:${String(index).padStart(2, "0")}.000Z`,
      updatedAt: `2026-04-27T00:00:${String(index).padStart(2, "0")}.000Z`
    }));
    const graph = buildRightBrainGraph({
      graph: toFlowGraph(records),
      activeNodeId: "root",
      fragments: []
    });
    const extensions = graph.nodes.filter(
      (node) => node.data.kind === "extension"
    );

    for (const [index, node] of extensions.entries()) {
      for (const other of extensions.slice(index + 1)) {
        expect(estimatedBoundsOverlap(node, other)).toBe(false);
      }
    }
  });

  it("clusters semantically related extensions while keeping unrelated branches apart", () => {
    const graph = buildRightBrainGraph({
      graph: {
        nodes: [
          createFlowNode({
            id: "root",
            kind: "dandelion",
            tags: ["canvas", "layout"],
            createdAt: "2026-04-27T00:00:00.000Z"
          }),
          createFlowNode({
            id: "layout-a",
            parentId: "root",
            tags: ["canvas", "layout"],
            createdAt: "2026-04-27T00:00:01.000Z"
          }),
          createFlowNode({
            id: "layout-b",
            parentId: "root",
            tags: ["canvas", "layout"],
            createdAt: "2026-04-27T00:00:02.000Z"
          }),
          createFlowNode({
            id: "offline",
            parentId: "root",
            tags: ["offline"],
            createdAt: "2026-04-27T00:00:03.000Z"
          })
        ],
        edges: [
          createFlowEdge("root", "layout-a"),
          createFlowEdge("root", "layout-b"),
          createFlowEdge("root", "offline")
        ]
      },
      activeNodeId: "root",
      fragments: []
    });
    const layoutA = graph.nodes.find((node) => node.id === "layout-a")!;
    const layoutB = graph.nodes.find((node) => node.id === "layout-b")!;
    const offline = graph.nodes.find((node) => node.id === "offline")!;

    expect(centerDistance(layoutA, layoutB)).toBeLessThan(
      centerDistance(layoutA, offline)
    );
  });

  it("keeps extensions that share center tags nearer to the dandelion center", () => {
    const graph = buildRightBrainGraph({
      graph: {
        nodes: [
          createFlowNode({
            id: "root",
            kind: "dandelion",
            tags: ["canvas", "layout"],
            createdAt: "2026-04-27T00:00:00.000Z"
          }),
          createFlowNode({
            id: "strongly-related",
            parentId: "root",
            tags: ["canvas", "layout"],
            createdAt: "2026-04-27T00:00:01.000Z"
          }),
          createFlowNode({
            id: "weakly-related",
            parentId: "root",
            tags: ["archive"],
            createdAt: "2026-04-27T00:00:02.000Z"
          })
        ],
        edges: [
          createFlowEdge("root", "strongly-related"),
          createFlowEdge("root", "weakly-related")
        ]
      },
      activeNodeId: "root",
      fragments: []
    });
    const root = graph.nodes.find((node) => node.id === "root")!;
    const stronglyRelated = graph.nodes.find(
      (node) => node.id === "strongly-related"
    )!;
    const weaklyRelated = graph.nodes.find(
      (node) => node.id === "weakly-related"
    )!;

    expect(centerDistance(root, stronglyRelated)).toBeLessThan(
      centerDistance(root, weaklyRelated)
    );
  });

  it("keeps semantically related newer extensions nearer to the center than older unrelated ones", () => {
    const graph = buildRightBrainGraph({
      graph: {
        nodes: [
          createFlowNode({
            id: "root",
            kind: "dandelion",
            tags: [],
            title: "学习路径",
            summary: "这颗蒲公英从如何真正学会一件事发起，关注宏观方向和微观步骤的配合。",
            createdAt: "2026-04-27T00:00:00.000Z"
          }),
          createFlowNode({
            id: "older-unrelated",
            parentId: "root",
            tags: [],
            title: "线下活动预算",
            summary: "以后单独讨论线下活动预算、人员安排和物料采购。",
            createdAt: "2026-04-27T00:00:01.000Z"
          }),
          createFlowNode({
            id: "newer-related",
            parentId: "root",
            tags: [],
            title: "先宏观后微观",
            summary: "先用宏观方向确认要学什么，再进入微观步骤，避免陷入碎片细节。",
            createdAt: "2026-04-27T00:00:02.000Z"
          })
        ],
        edges: [
          createFlowEdge("root", "older-unrelated"),
          createFlowEdge("root", "newer-related")
        ]
      },
      activeNodeId: "root",
      fragments: []
    });
    const root = graph.nodes.find((node) => node.id === "root")!;
    const olderUnrelated = graph.nodes.find(
      (node) => node.id === "older-unrelated"
    )!;
    const newerRelated = graph.nodes.find(
      (node) => node.id === "newer-related"
    )!;

    expect(centerDistance(root, newerRelated)).toBeLessThan(
      centerDistance(root, olderUnrelated)
    );
  });

  it("uses semantic similarity, not only tag overlap, to place related extensions close", () => {
    const graph = buildRightBrainGraph({
      graph: {
        nodes: [
          createFlowNode({
            id: "root",
            kind: "dandelion",
            tags: ["product"],
            createdAt: "2026-04-27T00:00:00.000Z"
          }),
          createFlowNode({
            id: "macro-step",
            parentId: "root",
            tags: ["learning"],
            title: "宏观学习框架",
            summary: "先用宏观框架确认目标、边界和问题结构。",
            createdAt: "2026-04-27T00:00:01.000Z"
          }),
          createFlowNode({
            id: "micro-step",
            parentId: "root",
            tags: ["practice"],
            title: "微观学习步骤",
            summary: "再用微观步骤推进练习、反馈和细节掌握。",
            createdAt: "2026-04-27T00:00:02.000Z"
          }),
          createFlowNode({
            id: "budget",
            parentId: "root",
            tags: ["finance"],
            title: "预算管理",
            summary: "以后单独讨论预算、人员和物料安排。",
            createdAt: "2026-04-27T00:00:03.000Z"
          })
        ],
        edges: [
          createFlowEdge("root", "macro-step"),
          createFlowEdge("root", "micro-step"),
          createFlowEdge("root", "budget")
        ]
      },
      activeNodeId: "root",
      fragments: []
    });
    const macroStep = graph.nodes.find((node) => node.id === "macro-step")!;
    const microStep = graph.nodes.find((node) => node.id === "micro-step")!;
    const budget = graph.nodes.find((node) => node.id === "budget")!;

    expect(centerDistance(macroStep, microStep)).toBeLessThan(
      centerDistance(macroStep, budget)
    );
  });

  it("clusters related extensions by their mutual distance instead of keeping even spokes", () => {
    const graph = buildRightBrainGraph({
      graph: {
        nodes: [
          createFlowNode({
            id: "root",
            kind: "dandelion",
            tags: [],
            title: "产品入口",
            summary: "这颗蒲公英从用户进入产品后如何开始发起。",
            createdAt: "2026-04-27T00:00:00.000Z"
          }),
          createFlowNode({
            id: "entry-start",
            parentId: "root",
            tags: [],
            title: "入口开场",
            summary: "第一屏要给用户一个明确开场，让他知道可以直接说出当前想法。",
            createdAt: "2026-04-27T00:00:01.000Z"
          }),
          createFlowNode({
            id: "entry-hint",
            parentId: "root",
            tags: [],
            title: "开始提示",
            summary: "开场提示要承接入口体验，降低用户不知道如何开始的犹豫。",
            createdAt: "2026-04-27T00:00:02.000Z"
          }),
          createFlowNode({
            id: "operation",
            parentId: "root",
            tags: [],
            title: "社群运营",
            summary: "之后再讨论社群节奏、内容发布和种子用户维护。",
            createdAt: "2026-04-27T00:00:03.000Z"
          }),
          createFlowNode({
            id: "budget",
            parentId: "root",
            tags: [],
            title: "预算安排",
            summary: "以后单独估算服务器成本、推广预算和外部协作支出。",
            createdAt: "2026-04-27T00:00:04.000Z"
          })
        ],
        edges: [
          createFlowEdge("root", "entry-start"),
          createFlowEdge("root", "entry-hint"),
          createFlowEdge("root", "operation"),
          createFlowEdge("root", "budget")
        ]
      },
      activeNodeId: "root",
      fragments: []
    });
    const entryStart = graph.nodes.find((node) => node.id === "entry-start")!;
    const entryHint = graph.nodes.find((node) => node.id === "entry-hint")!;
    const operation = graph.nodes.find((node) => node.id === "operation")!;
    const budget = graph.nodes.find((node) => node.id === "budget")!;

    expect(centerDistance(entryStart, entryHint)).toBeLessThan(
      centerDistance(entryStart, operation)
    );
    expect(centerDistance(entryStart, entryHint)).toBeLessThan(
      centerDistance(entryHint, budget)
    );
    expect(centerDistance(entryStart, entryHint)).toBeLessThan(300);
  });

  it("does not spread weakly related extensions evenly around the whole center", () => {
    const graph = buildRightBrainGraph({
      graph: {
        nodes: [
          createFlowNode({
            id: "root",
            kind: "dandelion",
            tags: [],
            title: "从仓库扫描到最短反馈",
            summary:
              "这颗蒲公英从学习路径过长、反馈太慢发起，想先找到可验证的最短路径。",
            createdAt: "2026-04-27T00:00:00.000Z"
          }),
          createFlowNode({
            id: "path",
            parentId: "root",
            tags: [],
            title: "最短可观察反馈路径",
            summary:
              "优先通过仓库扫描和最小入口跑通路径，避免一开始就做完整系统。",
            createdAt: "2026-04-27T00:00:01.000Z"
          }),
          createFlowNode({
            id: "mvp",
            parentId: "root",
            tags: [],
            title: "先跑通的最小MVP主线",
            summary:
              "第一阶段只保留能被观察和验证的主线，让系统先出现稳定结果。",
            createdAt: "2026-04-27T00:00:02.000Z"
          }),
          createFlowNode({
            id: "project",
            parentId: "root",
            tags: [],
            title: "保护中保持 Hermes 那样的进",
            summary:
              "要保留想法的流动性，同时让它逐步进入可验证的项目进展。",
            createdAt: "2026-04-27T00:00:03.000Z"
          }),
          createFlowNode({
            id: "same",
            parentId: "root",
            tags: [],
            title: "时于王者一个还没成形的想法",
            summary:
              "允许未成形的想法先被放在旁边，等到关系清晰后再收束。",
            createdAt: "2026-04-27T00:00:04.000Z"
          }),
          createFlowNode({
            id: "archive",
            parentId: "root",
            tags: [],
            title: "浮即能是",
            summary:
              "知识沉淀要服务于下一次反馈，而不是只留下孤立记录。",
            createdAt: "2026-04-27T00:00:05.000Z"
          })
        ],
        edges: [
          createFlowEdge("root", "path"),
          createFlowEdge("root", "mvp"),
          createFlowEdge("root", "project"),
          createFlowEdge("root", "same"),
          createFlowEdge("root", "archive")
        ]
      },
      activeNodeId: "root",
      fragments: []
    });
    const root = graph.nodes.find((node) => node.id === "root")!;
    const extensions = graph.nodes.filter((node) => node.data.kind === "extension");
    const angles = extensions
      .map((node) => angleFrom(root, node))
      .sort((a, b) => a - b);
    const spread = getSmallestCoveringAngle(angles);

    expect(spread).toBeLessThan(Math.PI * 1.05);
  });

  it("uses inferred extension-to-extension edges inside related clusters", () => {
    const graph = buildRightBrainGraph({
      graph: {
        nodes: [
          createFlowNode({
            id: "root",
            kind: "dandelion",
            tags: ["canvas", "layout"],
            createdAt: "2026-04-27T00:00:00.000Z"
          }),
          createFlowNode({
            id: "layout-a",
            parentId: "root",
            tags: ["canvas", "layout"],
            createdAt: "2026-04-27T00:00:01.000Z"
          }),
          createFlowNode({
            id: "layout-b",
            parentId: "root",
            tags: ["canvas", "layout"],
            createdAt: "2026-04-27T00:00:02.000Z"
          }),
          createFlowNode({
            id: "offline",
            parentId: "root",
            tags: ["offline"],
            createdAt: "2026-04-27T00:00:03.000Z"
          })
        ],
        edges: [
          createFlowEdge("root", "layout-a"),
          createFlowEdge("root", "layout-b"),
          createFlowEdge("root", "offline")
        ]
      },
      activeNodeId: "root",
      fragments: []
    });
    const rootEdges = graph.edges.filter((edge) => edge.source === "root");
    const inferredClusterEdge = graph.edges.find(
      (edge) => edge.source === "layout-a" && edge.target === "layout-b"
    );

    expect(rootEdges.map((edge) => edge.target).sort()).toEqual([
      "layout-a",
      "offline"
    ]);
    expect(inferredClusterEdge).toMatchObject({
      id: "inferred-layout-a-layout-b",
      type: "floating",
      data: {
        inferred: true
      }
    });
    expect(["derivation", "support", "association"]).toContain(
      inferredClusterEdge?.data?.relationKind
    );
  });

  it("lets user-edited relation kinds override inferred extension relations", () => {
    const graph = buildRightBrainGraph({
      graph: {
        nodes: [
          createFlowNode({
            id: "root",
            kind: "dandelion",
            tags: ["canvas", "layout"],
            createdAt: "2026-04-27T00:00:00.000Z"
          }),
          createFlowNode({
            id: "layout-a",
            parentId: "root",
            tags: ["canvas", "layout"],
            createdAt: "2026-04-27T00:00:01.000Z"
          }),
          createFlowNode({
            id: "layout-b",
            parentId: "root",
            tags: ["canvas", "layout"],
            createdAt: "2026-04-27T00:00:02.000Z"
          })
        ],
        edges: [
          createFlowEdge("root", "layout-a"),
          createFlowEdge("root", "layout-b")
        ]
      },
      activeNodeId: "root",
      fragments: [],
      relations: [
        {
          sourceNodeId: "layout-a",
          targetNodeId: "layout-b",
          relationKind: "conflict"
        }
      ]
    });
    const edge = graph.edges.find(
      (candidate) => candidate.source === "layout-a" && candidate.target === "layout-b"
    );

    expect(edge).toMatchObject({
      label: "冲突",
      data: {
        relationKind: "conflict",
        userEdited: true
      }
    });
  });

  it("lets user-edited relation kinds override parent extension relations", () => {
    const graph = buildRightBrainGraph({
      graph: toFlowGraph([
        {
          id: "root",
          parentId: null,
          title: "当前蒲公英",
          content: "中心",
          positionX: 0,
          positionY: 0,
          createdAt: "2026-04-27T00:00:00.000Z",
          updatedAt: "2026-04-27T00:00:00.000Z"
        },
        {
          id: "child",
          parentId: "root",
          title: "延伸",
          content: "一个延伸",
          positionX: 0,
          positionY: 0,
          createdAt: "2026-04-27T00:00:01.000Z",
          updatedAt: "2026-04-27T00:00:01.000Z"
        }
      ]),
      activeNodeId: "root",
      fragments: [],
      relations: [
        {
          sourceNodeId: "root",
          targetNodeId: "child",
          relationKind: "association"
        }
      ]
    });

    expect(graph.edges[0]).toMatchObject({
      source: "root",
      target: "child",
      label: "联想",
      data: {
        relationKind: "association",
        userEdited: true
      }
    });
  });

  it("treats duplicate extension copy as a strong relation even when tags are sparse", () => {
    const graph = buildRightBrainGraph({
      graph: {
        nodes: [
          createFlowNode({
            id: "root",
            kind: "dandelion",
            tags: ["root"],
            createdAt: "2026-04-27T00:00:00.000Z"
          }),
          createFlowNode({
            id: "duplicate-a",
            parentId: "root",
            tags: [],
            title: "same idea",
            summary: "same idea about readable line routing",
            createdAt: "2026-04-27T00:00:01.000Z"
          }),
          createFlowNode({
            id: "duplicate-b",
            parentId: "root",
            tags: [],
            title: "same idea",
            summary: "same idea about readable line routing",
            createdAt: "2026-04-27T00:00:02.000Z"
          }),
          createFlowNode({
            id: "different",
            parentId: "root",
            tags: [],
            title: "offline budget",
            summary: "offline budget for later",
            createdAt: "2026-04-27T00:00:03.000Z"
          })
        ],
        edges: [
          createFlowEdge("root", "duplicate-a"),
          createFlowEdge("root", "duplicate-b"),
          createFlowEdge("root", "different")
        ]
      },
      activeNodeId: "root",
      fragments: []
    });
    const duplicateA = graph.nodes.find((node) => node.id === "duplicate-a")!;
    const duplicateB = graph.nodes.find((node) => node.id === "duplicate-b")!;
    const different = graph.nodes.find((node) => node.id === "different")!;

    expect(centerDistance(duplicateA, duplicateB)).toBeLessThan(
      centerDistance(duplicateA, different)
    );
    expect(
      graph.edges.some(
        (edge) =>
          edge.id === "inferred-duplicate-a-duplicate-b" &&
          edge.data?.inferred === true &&
          edge.data?.relationKind === "derivation"
      )
    ).toBe(true);
  });

  it("uses explicit relation strength before falling back to even radial spacing", () => {
    const graph = buildRightBrainGraph({
      graph: {
        nodes: [
          createFlowNode({
            id: "root",
            kind: "dandelion",
            tags: [],
            title: "产品方向",
            summary: "这颗蒲公英从如何推进产品方向发起。",
            createdAt: "2026-04-27T00:00:00.000Z"
          }),
          createFlowNode({
            id: "core-a",
            parentId: "root",
            tags: [],
            title: "入口体验",
            summary: "进入页面后要先让用户知道从哪里开始。",
            createdAt: "2026-04-27T00:00:01.000Z"
          }),
          createFlowNode({
            id: "core-b",
            parentId: "root",
            tags: [],
            title: "开场引导",
            summary: "新用户需要明确的第一句话和操作提示。",
            createdAt: "2026-04-27T00:00:02.000Z"
          }),
          createFlowNode({
            id: "side",
            parentId: "root",
            tags: [],
            title: "运营素材",
            summary: "之后再讨论宣传物料和社群节奏。",
            createdAt: "2026-04-27T00:00:03.000Z"
          })
        ],
        edges: [
          createFlowEdge("root", "core-a"),
          createFlowEdge("root", "core-b"),
          createFlowEdge("root", "side")
        ]
      },
      relations: [
        {
          sourceNodeId: "root",
          targetNodeId: "core-a",
          relationKind: "derivation",
          strength: 0.9
        },
        {
          sourceNodeId: "root",
          targetNodeId: "core-b",
          relationKind: "derivation",
          strength: 0.86
        },
        {
          sourceNodeId: "root",
          targetNodeId: "side",
          relationKind: "association",
          strength: 0.2
        },
        {
          sourceNodeId: "core-a",
          targetNodeId: "core-b",
          relationKind: "support",
          strength: 0.92
        }
      ],
      activeNodeId: "root",
      fragments: []
    });
    const root = graph.nodes.find((node) => node.id === "root")!;
    const coreA = graph.nodes.find((node) => node.id === "core-a")!;
    const coreB = graph.nodes.find((node) => node.id === "core-b")!;
    const side = graph.nodes.find((node) => node.id === "side")!;

    expect(centerDistance(coreA, coreB)).toBeLessThan(centerDistance(coreA, side));
    expect(centerDistance(root, coreA)).toBeLessThan(centerDistance(root, side));
    expect(centerDistance(root, coreB)).toBeLessThan(centerDistance(root, side));
  });

  it("keeps identical extension copy on a stable strong relation despite tag noise", () => {
    const graph = buildRightBrainGraph({
      graph: {
        nodes: [
          createFlowNode({
            id: "root",
            kind: "dandelion",
            tags: ["root"],
            createdAt: "2026-04-27T00:00:00.000Z"
          }),
          createFlowNode({
            id: "copy-a",
            parentId: "root",
            tags: ["layout", "routing"],
            title: "line endpoint quality",
            summary: "choose endpoints that avoid unnecessary detours",
            createdAt: "2026-04-27T00:00:01.000Z"
          }),
          createFlowNode({
            id: "copy-b",
            parentId: "root",
            tags: ["summary"],
            title: "line endpoint quality",
            summary: "choose endpoints that avoid unnecessary detours",
            createdAt: "2026-04-27T00:00:02.000Z"
          }),
          createFlowNode({
            id: "copy-c",
            parentId: "root",
            tags: [],
            title: "line endpoint quality",
            summary: "choose endpoints that avoid unnecessary detours",
            createdAt: "2026-04-27T00:00:03.000Z"
          })
        ],
        edges: [
          createFlowEdge("root", "copy-a"),
          createFlowEdge("root", "copy-b"),
          createFlowEdge("root", "copy-c")
        ]
      },
      activeNodeId: "root",
      fragments: []
    });
    const inferredEdges = graph.edges.filter((edge) => edge.data?.inferred);

    expect(inferredEdges).toHaveLength(2);
    expect(
      inferredEdges.every((edge) => edge.data?.relationKind === "derivation")
    ).toBe(true);
  });

  it("places more related fragments nearer to the current dandelion while keeping them unconnected", () => {
    const graph = buildRightBrainGraph({
      graph: toFlowGraph([
        {
          id: "root",
          parentId: null,
          title: "画布排版",
          content: "当前讨论画布布局和关系线可读性。",
          positionX: 0,
          positionY: 0,
          createdAt: "2026-04-27T00:00:00.000Z",
          updatedAt: "2026-04-27T00:00:00.000Z"
        }
      ]),
      activeNodeId: "root",
      fragments: [
        {
          id: "related",
          content: "碎片靠近画布中心",
          originalContext: "碎片和当前主题相关度大就离中心近。",
          sentimentVibe: null,
          createdAt: "2026-04-28T00:00:00.000Z"
        },
        {
          id: "unrelated",
          content: "线下活动预算",
          originalContext: "线下活动预算以后再单独讨论。",
          sentimentVibe: null,
          createdAt: "2026-04-28T00:00:01.000Z"
        }
      ],
      visibleFragmentIds: ["related", "unrelated"]
    });
    const related = graph.nodes.find((node) => node.id === "fragment-related")!;
    const unrelated = graph.nodes.find(
      (node) => node.id === "fragment-unrelated"
    )!;
    const distanceFromRoot = (node: typeof related) =>
      Math.hypot(node.position.x + 112 - 160, node.position.y + 72 - 90);

    expect(distanceFromRoot(related)).toBeLessThan(
      distanceFromRoot(unrelated)
    );
    expect(graph.edges).toHaveLength(0);
  });

  it("uses selected fragment ids when managing visible fragments", () => {
    const graph = buildRightBrainGraph({
      graph: toFlowGraph([
        {
          id: "root",
          parentId: null,
          title: "入口灵感",
          content: "一粒种子",
          positionX: 0,
          positionY: 0,
          createdAt: "2026-04-27T00:00:00.000Z",
          updatedAt: "2026-04-27T00:00:00.000Z"
        },
      ]),
      activeNodeId: "root",
      fragments: [
        {
          id: "visible-fragment",
          content: "可见碎片",
          originalContext: "一个可见碎片。",
          sentimentVibe: null,
          createdAt: "2026-04-28T00:00:00.000Z"
        },
        {
          id: "hidden-fragment",
          content: "隐藏碎片",
          originalContext: "一个隐藏碎片。",
          sentimentVibe: null,
          createdAt: "2026-04-28T00:00:01.000Z"
        }
      ],
      visibleFragmentIds: ["visible-fragment"]
    });

    expect(graph.nodes.map((node) => node.id)).toEqual([
      "root",
      "fragment-visible-fragment"
    ]);
  });
});

function estimatedBoundsOverlap(
  a: ReturnType<typeof buildRightBrainGraph>["nodes"][number],
  b: ReturnType<typeof buildRightBrainGraph>["nodes"][number]
) {
  const aCenter = {
    x: a.position.x + getNodeWidth(a) / 2,
    y: a.position.y + getNodeHeight(a) / 2
  };
  const bCenter = {
    x: b.position.x + getNodeWidth(b) / 2,
    y: b.position.y + getNodeHeight(b) / 2
  };

  return (
    Math.abs(aCenter.x - bCenter.x) < (getNodeWidth(a) + getNodeWidth(b)) / 2 + 36 &&
    Math.abs(aCenter.y - bCenter.y) < (getNodeHeight(a) + getNodeHeight(b)) / 2 + 32
  );
}

function createFlowNode(input: {
  id: string;
  parentId?: string | null;
  kind?: "dandelion" | "extension";
  tags: string[];
  createdAt: string;
  title?: string;
  content?: string;
  displayTitle?: string;
  summary?: string;
}) {
  const title = input.title ?? input.id;
  const content = input.content ?? input.id;
  const displayTitle = input.displayTitle ?? title;
  const summary = input.summary ?? content;

  return {
    id: input.id,
    type: "topic",
    position: { x: 0, y: 0 },
    data: {
      title,
      content,
      displayTitle,
      summary,
      tags: input.tags,
      visualSize: "compact" as const,
      createdAt: input.createdAt,
      parentId: input.parentId ?? null,
      isCurrent: input.kind === "dandelion",
      kind: input.kind ?? "extension"
    }
  };
}

function createFlowEdge(source: string, target: string) {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: "floating"
  };
}

function centerDistance(
  a: ReturnType<typeof buildRightBrainGraph>["nodes"][number],
  b: ReturnType<typeof buildRightBrainGraph>["nodes"][number]
) {
  return Math.hypot(
    a.position.x + getNodeWidth(a) / 2 - (b.position.x + getNodeWidth(b) / 2),
    a.position.y + getNodeHeight(a) / 2 - (b.position.y + getNodeHeight(b) / 2)
  );
}

function angleFrom(
  root: ReturnType<typeof buildRightBrainGraph>["nodes"][number],
  node: ReturnType<typeof buildRightBrainGraph>["nodes"][number]
) {
  return Math.atan2(
    node.position.y + getNodeHeight(node) / 2 - (root.position.y + getNodeHeight(root) / 2),
    node.position.x + getNodeWidth(node) / 2 - (root.position.x + getNodeWidth(root) / 2)
  );
}

function getSmallestCoveringAngle(sortedAngles: number[]) {
  if (sortedAngles.length <= 1) {
    return 0;
  }

  const normalized = sortedAngles.map((angle) =>
    angle < 0 ? angle + Math.PI * 2 : angle
  ).sort((a, b) => a - b);
  const gaps = normalized.map((angle, index) => {
    const next = normalized[(index + 1) % normalized.length]!;
    return index === normalized.length - 1
      ? next + Math.PI * 2 - angle
      : next - angle;
  });
  const largestGap = Math.max(...gaps);

  return Math.PI * 2 - largestGap;
}

function getNodeWidth(
  node: ReturnType<typeof buildRightBrainGraph>["nodes"][number]
) {
  if (node.data.kind === "dandelion") {
    return 320;
  }

  if (node.data.kind === "fragment") {
    return 224;
  }

  return node.data.visualSize === "compact" ? 240 : 288;
}

function getNodeHeight(
  node: ReturnType<typeof buildRightBrainGraph>["nodes"][number]
) {
  if (node.data.kind === "dandelion") {
    return 180;
  }

  if (node.data.kind === "fragment") {
    return 144;
  }

  if (node.data.visualSize === "tall") {
    return 176;
  }

  return node.data.visualSize === "wide" ? 150 : 140;
}

describe("getRelationVisualStyle", () => {
  it("uses stronger lines for derivation and lighter lines for association", () => {
    expect(getRelationVisualStyle("derivation").style).toMatchObject({
      strokeWidth: 3
    });
    expect(getRelationVisualStyle("association").style).toMatchObject({
      strokeDasharray: "5 7",
      strokeWidth: 1.6
    });
    expect(getRelationVisualStyle("conflict").label).toBe("冲突");
  });
});
