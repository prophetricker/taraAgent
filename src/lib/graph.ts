import type { Edge, Node } from "@xyflow/react";

import { formatFragmentCopy } from "./fragments";

export type InspirationNodeRecord = {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  positionX: number;
  positionY: number;
  createdAt: string;
  updatedAt: string;
};

export type InspirationFlowNodeData = {
  title: string;
  content: string;
  createdAt: string;
  isCurrent: boolean;
  kind: "topic" | "fragment";
  vibe?: string;
};

export type DandelionFragmentFlowRecord = {
  id: string;
  content: string;
  originalContext: string;
  sentimentVibe: string | null;
  createdAt: string;
};

export function toFlowGraph(records: InspirationNodeRecord[]): {
  nodes: Node<InspirationFlowNodeData>[];
  edges: Edge[];
} {
  const nodes = records.map((record) => ({
    id: record.id,
    type: "topic",
    position: {
      x: record.positionX,
      y: record.positionY
    },
    data: {
        title: record.title,
        content: record.content,
        createdAt: record.createdAt,
        isCurrent: record.parentId === null,
        kind: "topic" as const
      }
  }));

  const edges = records
    .filter((record) => record.parentId)
    .map((record) => ({
      id: `${record.parentId}-${record.id}`,
      source: record.parentId!,
      target: record.id,
      animated: true
    }));

  return { nodes, edges };
}

export function buildRightBrainGraph(input: {
  graph: {
    nodes: Node<InspirationFlowNodeData>[];
    edges: Edge[];
  };
  activeNodeId: string;
  fragments: DandelionFragmentFlowRecord[];
  maxPastTopics?: number;
}): {
  nodes: Node<InspirationFlowNodeData>[];
  edges: Edge[];
} {
  const maxPastTopics = input.maxPastTopics ?? 5;
  const activeNode = input.graph.nodes.find(
    (node) => node.id === input.activeNodeId
  );
  const currentTopic =
    activeNode ?? input.graph.nodes.find((node) => node.data.isCurrent);
  const activeNodeId = currentTopic?.id ?? input.activeNodeId;
  const anchorPosition = currentTopic?.position ?? { x: 0, y: 0 };
  const topicNodes = currentTopic
    ? [
        {
          ...currentTopic,
          data: {
            ...currentTopic.data,
            isCurrent: true
          }
        },
        ...layoutPastTopics({
          nodes: input.graph.nodes.filter((node) => node.id !== currentTopic.id),
          anchorPosition,
          maxPastTopics
        })
      ]
    : input.graph.nodes;
  const fragmentNodes = input.fragments.slice(0, 8).map((fragment, index) => {
    const copy = formatFragmentCopy(fragment);
    const angle = getFragmentAngle(index, Math.min(input.fragments.length, 8));
    const radiusX = 390;
    const radiusY = 260;

    return {
      id: getFragmentNodeId(fragment.id),
      type: "fragment",
      draggable: false,
      position: {
        x: anchorPosition.x + 40 + Math.cos(angle) * radiusX,
        y: anchorPosition.y + 24 + Math.sin(angle) * radiusY
      },
      data: {
        title: copy.title,
        content: copy.preview,
        createdAt: fragment.createdAt,
        isCurrent: false,
        kind: "fragment" as const,
        vibe: copy.vibe
      }
    };
  });
  const fragmentEdges = fragmentNodes.map((node) => ({
    id: `${activeNodeId}-${node.id}`,
    source: activeNodeId,
    target: node.id,
    animated: false,
    type: "smoothstep",
    label: "旁支灵感",
    style: {
      stroke: "#c9aa5a",
      strokeDasharray: "5 7",
      opacity: 0.6
    },
    labelStyle: {
      fill: "#8c6f24",
      fontSize: 11,
      fontWeight: 600
    },
    labelBgStyle: {
      fill: "#fff8e8",
      fillOpacity: 0.75
    }
  }));
  const visibleTopicIds = new Set(topicNodes.map((node) => node.id));
  const visibleTopicEdges = input.graph.edges.filter(
    (edge) => visibleTopicIds.has(edge.source) && visibleTopicIds.has(edge.target)
  );

  return {
    nodes: [...topicNodes, ...fragmentNodes],
    edges: [...visibleTopicEdges, ...fragmentEdges]
  };
}

function getFragmentNodeId(fragmentId: string) {
  return `fragment-${fragmentId}`;
}

function layoutPastTopics(input: {
  nodes: Node<InspirationFlowNodeData>[];
  anchorPosition: { x: number; y: number };
  maxPastTopics: number;
}) {
  return [...input.nodes]
    .sort((a, b) => b.data.createdAt.localeCompare(a.data.createdAt))
    .slice(0, input.maxPastTopics)
    .map((node, index) => {
      const angle = Math.PI * 0.78 + index * 0.42;

      return {
        ...node,
        position: {
          x: input.anchorPosition.x - 90 + Math.cos(angle) * 440,
          y: input.anchorPosition.y + 40 + Math.sin(angle) * 300
        },
        data: {
          ...node.data,
          isCurrent: false
        }
      };
    });
}

function getFragmentAngle(index: number, count: number) {
  if (count === 1) {
    return -0.12;
  }

  const start = -0.95;
  const end = 0.95;

  return start + (index / Math.max(count - 1, 1)) * (end - start);
}
