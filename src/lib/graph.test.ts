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
          edge.data?.inferred === true
      )
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
