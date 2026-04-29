import { describe, expect, it } from "vitest";

import { buildRightBrainGraph, toFlowGraph } from "./graph";

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
      data: { title: "入口灵感", content: "一粒种子", isCurrent: true }
    });
    expect(graph.nodes[1]).toMatchObject({
      id: "child",
      data: { title: "旁支", content: "延伸想法", isCurrent: false }
    });
    expect(graph.edges).toEqual([
      {
        id: "root-child",
        source: "root",
        target: "child",
        animated: true
      }
    ]);
  });
});

describe("buildRightBrainGraph", () => {
  it("adds connected dandelion nodes around the active topic", () => {
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
        kind: "fragment"
      }
    });
    expect(withFragments.edges).toHaveLength(1);
    expect(withFragments.edges[0]).toMatchObject({
      id: "root-fragment-fragment-1",
      source: "root",
      target: "fragment-fragment-1",
      animated: false,
      type: "smoothstep",
      label: "旁支灵感",
      style: {
        strokeDasharray: "5 7"
      }
    });
  });

  it("keeps the active topic as the layout anchor and limits historical traces", () => {
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
      maxPastTopics: 3
    });

    expect(graph.nodes).toHaveLength(4);
    expect(graph.nodes[0]).toMatchObject({
      id: "root",
      position: { x: 900, y: 800 },
      data: { isCurrent: true }
    });
    expect(graph.nodes.slice(1).every((node) => !node.data.isCurrent)).toBe(
      true
    );
  });
});
