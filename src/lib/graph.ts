import type { Edge, Node } from "@xyflow/react";

import { formatFragmentCopy } from "./fragments";
import { extractIdeaTags, formatIdeaNodeCopy } from "./idea-copy";

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
  displayTitle: string;
  summary: string;
  tags: string[];
  visualSize: "compact" | "wide" | "tall";
  createdAt: string;
  parentId?: string | null;
  isCurrent: boolean;
  kind: "dandelion" | "extension" | "fragment";
  ageTone?: "new" | "middle" | "old";
  sourceTitle?: string;
  vibe?: string;
  highlightedTag?: string | null;
  onTagHover?: (tag: string | null) => void;
};

export type IdeaRelationKind =
  | "derivation"
  | "association"
  | "support"
  | "conflict"
  | "analogy"
  | "capture"
  | "pending";

export type DandelionFragmentFlowRecord = {
  id: string;
  content: string;
  originalContext: string;
  sentimentVibe: string | null;
  createdAt: string;
};

type EstimatedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ExtensionLayout = {
  nodes: Node<InspirationFlowNodeData>[];
  inferredEdges: Edge[];
  clusterIdByNodeId: Map<string, string>;
  clusterSizes: Map<string, number>;
};

type ExtensionGroup = {
  id: string;
  members: Node<InspirationFlowNodeData>[];
};

const NODE_SIZE = {
  dandelion: { width: 368, height: 220 },
  extension: {
    compact: { width: 240, height: 140 },
    wide: { width: 288, height: 150 },
    tall: { width: 288, height: 176 }
  },
  fragment: { width: 224, height: 144 }
} as const;

export function toFlowGraph(records: InspirationNodeRecord[]): {
  nodes: Node<InspirationFlowNodeData>[];
  edges: Edge[];
} {
  const nodes = records.map((record) => {
    const copy = formatIdeaNodeCopy({
      title: record.title,
      content: record.content,
      role: record.parentId === null ? "dandelion" : "extension"
    });

    return {
      id: record.id,
      type: "topic",
      position: {
        x: record.positionX,
        y: record.positionY
      },
      data: {
        title: record.title,
        content: record.content,
        displayTitle: copy.displayTitle,
        summary: copy.summary,
        tags: copy.tags,
        visualSize: getNodeVisualSize(copy),
        createdAt: record.createdAt,
        parentId: record.parentId,
        isCurrent: record.parentId === null,
        kind:
          record.parentId === null
            ? ("dandelion" as const)
            : ("extension" as const)
      }
    };
  });

  const edges = records
    .filter((record) => record.parentId)
    .map((record) => ({
      id: `${record.parentId}-${record.id}`,
      source: record.parentId!,
      target: record.id,
      animated: true,
      type: "floating",
      zIndex: 2,
      ...getRelationVisualStyle("derivation"),
      data: {
        relationKind: "derivation" satisfies IdeaRelationKind
      }
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
  maxExtensions?: number;
  visibleFragmentIds?: string[];
}): {
  nodes: Node<InspirationFlowNodeData>[];
  edges: Edge[];
} {
  const maxExtensions = input.maxExtensions ?? Number.POSITIVE_INFINITY;
  const activeNode = input.graph.nodes.find(
    (node) => node.id === input.activeNodeId
  );
  const currentTopic =
    activeNode ?? input.graph.nodes.find((node) => node.data.isCurrent);
  const anchorPosition = currentTopic?.position ?? { x: 0, y: 0 };
  const extensionNodes = currentTopic
    ? getVisibleExtensionNodes({
        nodes: input.graph.nodes,
        edges: input.graph.edges,
        activeNodeId: currentTopic.id,
        maxExtensions
      })
    : [];
  const extensionLayout = currentTopic
    ? layoutVisibleExtensions({
        nodes: extensionNodes,
        edges: input.graph.edges,
        activeNodeId: currentTopic.id,
        anchorPosition
      })
    : {
        nodes: [],
        inferredEdges: [],
        clusterIdByNodeId: new Map<string, string>(),
        clusterSizes: new Map<string, number>()
      };
  const topicNodes = currentTopic
    ? [
        {
          ...currentTopic,
          draggable: true,
          data: {
            ...currentTopic.data,
            isCurrent: true
          }
        },
        ...extensionLayout.nodes
      ]
    : input.graph.nodes;
  const visibleFragments = getVisibleFragments({
    fragments: input.fragments,
    visibleFragmentIds: input.visibleFragmentIds
  });
  const fragmentNodes = layoutVisibleFragments({
    fragments: visibleFragments.slice(0, 12),
    currentTopic,
    occupiedNodes: topicNodes,
    anchorPosition
  });
  const visibleTopicIds = new Set(topicNodes.map((node) => node.id));
  const visibleTopicEdges = input.graph.edges.filter(
    (edge) =>
      visibleTopicIds.has(edge.source) &&
      visibleTopicIds.has(edge.target) &&
      shouldKeepVisibleEdge({
        edge,
        activeNodeId: currentTopic?.id ?? input.activeNodeId,
        clusterIdByNodeId: extensionLayout.clusterIdByNodeId,
        clusterSizes: extensionLayout.clusterSizes
      })
  );

  return {
    nodes: [...topicNodes, ...fragmentNodes],
    edges: [...visibleTopicEdges, ...extensionLayout.inferredEdges]
  };
}

function layoutVisibleExtensions(input: {
  nodes: Node<InspirationFlowNodeData>[];
  edges: Edge[];
  activeNodeId: string;
  anchorPosition: { x: number; y: number };
}): ExtensionLayout {
  const total = input.nodes.length;
  const anchorCenter = getNodeCenter(
    input.anchorPosition,
    NODE_SIZE.dandelion.width,
    NODE_SIZE.dandelion.height
  );
  const rootTags =
    input.nodes.find((node) => node.id === input.activeNodeId)?.data.tags ?? [];
  const groups = groupExtensionsBySimilarity(input.nodes);
  const occupiedRects: EstimatedRect[] = [
    {
      ...input.anchorPosition,
      width: NODE_SIZE.dandelion.width,
      height: NODE_SIZE.dandelion.height
    }
  ];
  const placedNodes: Node<InspirationFlowNodeData>[] = [];
  const inferredEdges: Edge[] = [];
  const clusterIdByNodeId = new Map<string, string>();
  const clusterSizes = new Map<string, number>();

  for (const [groupIndex, group] of groups.entries()) {
    const groupAngle = getGroupAngle(group, groupIndex, groups.length);
    const representative = getGroupRepresentative(group, rootTags);
    const orderedGroup = [
      representative,
      ...group.members
        .filter((node) => node.id !== representative.id)
        .sort(
          (a, b) =>
            getNodeSimilarity(b.data, representative.data) -
              getNodeSimilarity(a.data, representative.data) ||
            a.data.createdAt.localeCompare(b.data.createdAt)
        )
    ];

    clusterSizes.set(group.id, orderedGroup.length);

    for (const [indexInGroup, node] of orderedGroup.entries()) {
      const size = getNodeSize(node);
      const centerSimilarity = getTagSimilarity(rootTags, node.data.tags);
      const ageIndex = input.nodes.findIndex((candidate) => candidate.id === node.id);
      const targetRadius =
        340 +
        (1 - centerSimilarity) * 240 +
        Math.max(ageIndex, 0) * 18 +
        (node.id === representative.id ? 0 : indexInGroup * 34);
      const angle =
        groupAngle +
        getGroupSpreadOffset(indexInGroup, orderedGroup.length) +
        (hashText(node.id) % 17) * 0.004;
      const desiredPosition = {
        x: anchorCenter.x + Math.cos(angle) * targetRadius - size.width / 2,
        y: anchorCenter.y + Math.sin(angle) * targetRadius - size.height / 2
      };
      const position = chooseReadablePosition({
        desiredPosition,
        size,
        angle,
        radius: targetRadius,
        anchorCenter,
        occupiedRects,
        placedNodes,
        node
      });

      occupiedRects.push({ ...position, ...size });
      placedNodes.push({
        ...node,
        draggable: false,
        position,
        data: {
          ...node.data,
          isCurrent: false,
          ageTone: getExtensionAgeTone(ageIndex, total)
        }
      });
      clusterIdByNodeId.set(node.id, group.id);

      if (node.id !== representative.id) {
        inferredEdges.push(createInferredClusterEdge(representative, node));
      }
    }
  }

  return {
    nodes: placedNodes,
    inferredEdges,
    clusterIdByNodeId,
    clusterSizes
  };
}

function groupExtensionsBySimilarity(nodes: Node<InspirationFlowNodeData>[]) {
  const groups: ExtensionGroup[] = [];

  for (const node of nodes) {
    let bestGroupIndex = -1;
    let bestScore = 0;

    for (const [index, group] of groups.entries()) {
      const score = Math.max(
        ...group.members.map((member) => getNodeSimilarity(member.data, node.data))
      );

      if (score > bestScore) {
        bestScore = score;
        bestGroupIndex = index;
      }
    }

    if (bestGroupIndex >= 0 && bestScore >= 0.38) {
      groups[bestGroupIndex].members.push(node);
    } else {
      groups.push({
        id: node.id,
        members: [node]
      });
    }
  }

  return groups.sort((a, b) => getGroupSortKey(a).localeCompare(getGroupSortKey(b)));
}

function getGroupAngle(
  group: ExtensionGroup,
  groupIndex: number,
  totalGroups: number
) {
  const primaryTag = getGroupSortKey(group);
  const preferredAngles: Record<string, number> = {
    画布: -0.7,
    布局: -0.45,
    关系线: 0.04,
    延伸: 0.48,
    碎片: 0.92,
    聚类: 1.28,
    视角: -1.28,
    交互: 1.78
  };

  if (preferredAngles[primaryTag] !== undefined) {
    return preferredAngles[primaryTag];
  }

  return normalizeAngle(-0.9 + (Math.PI * 2 * groupIndex) / Math.max(totalGroups, 1));
}

function getGroupSortKey(group: ExtensionGroup) {
  return group.members[0]?.data.tags[0] ?? group.id;
}

function getGroupRepresentative(
  group: ExtensionGroup,
  rootTags: string[]
) {
  return [...group.members].sort(
    (a, b) =>
      getTagSimilarity(rootTags, b.data.tags) -
        getTagSimilarity(rootTags, a.data.tags) ||
      a.data.createdAt.localeCompare(b.data.createdAt)
  )[0]!;
}

function getGroupSpreadOffset(index: number, total: number) {
  if (total <= 1) {
    return 0;
  }

  return (index - (total - 1) / 2) * 0.24;
}

function chooseReadablePosition(input: {
  desiredPosition: { x: number; y: number };
  size: { width: number; height: number };
  angle: number;
  radius: number;
  anchorCenter: { x: number; y: number };
  occupiedRects: EstimatedRect[];
  placedNodes: Node<InspirationFlowNodeData>[];
  node: Node<InspirationFlowNodeData>;
}) {
  const candidates = getLayoutCandidates(input).map((position) => {
    const rect = { ...position, ...input.size };

    return {
      position,
      score:
        getOverlapPenalty(rect, input.occupiedRects, 54, 40) +
        getSemanticDistancePenalty(input.node, position, input.placedNodes) +
        getDistance(
          getNodeCenter(position, input.size.width, input.size.height),
          input.anchorCenter
        ) *
          0.03 +
        getDistance(position, input.desiredPosition) * 0.7
    };
  });

  return candidates.sort((a, b) => a.score - b.score)[0]?.position ?? input.desiredPosition;
}

function getLayoutCandidates(input: {
  desiredPosition: { x: number; y: number };
  size: { width: number; height: number };
  angle: number;
  radius: number;
  anchorCenter: { x: number; y: number };
}) {
  const candidates: Array<{ x: number; y: number }> = [];

  for (const angleOffset of [0, -0.2, 0.2, -0.36, 0.36, -0.56, 0.56]) {
    for (const radiusOffset of [0, 82, -46, 150, 226]) {
      const radius = Math.max(260, input.radius + radiusOffset);
      const angle = input.angle + angleOffset;

      candidates.push({
        x: input.anchorCenter.x + Math.cos(angle) * radius - input.size.width / 2,
        y: input.anchorCenter.y + Math.sin(angle) * radius - input.size.height / 2
      });
    }
  }

  candidates.push(input.desiredPosition);

  return candidates;
}

function getSemanticDistancePenalty(
  node: Node<InspirationFlowNodeData>,
  position: { x: number; y: number },
  placedNodes: Node<InspirationFlowNodeData>[]
) {
  const nodeSize = getNodeSize(node);
  const center = getNodeCenter(position, nodeSize.width, nodeSize.height);

  return placedNodes.reduce((penalty, placedNode) => {
    const similarity = getTagSimilarity(node.data.tags, placedNode.data.tags);

    if (similarity <= 0) {
      return penalty;
    }

    const placedSize = getNodeSize(placedNode);
    const placedCenter = getNodeCenter(
      placedNode.position,
      placedSize.width,
      placedSize.height
    );
    const distance = getDistance(center, placedCenter);
    const targetDistance = 300 - similarity * 120;

    return penalty + Math.abs(distance - targetDistance) * similarity * 1.8;
  }, 0);
}

function getNodeSimilarity(
  a: Pick<InspirationFlowNodeData, "tags" | "displayTitle" | "summary">,
  b: Pick<InspirationFlowNodeData, "tags" | "displayTitle" | "summary">
) {
  const tagSimilarity = getTagSimilarity(a.tags, b.tags);
  const textSimilarity = getTextSimilarity(
    `${a.displayTitle} ${a.summary}`,
    `${b.displayTitle} ${b.summary}`
  );

  return tagSimilarity * 0.55 + textSimilarity * 0.45;
}

function getTextSimilarity(a: string, b: string) {
  const left = getTextFingerprint(a);
  const right = getTextFingerprint(b);

  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((char) => rightSet.has(char)).length;
  const union = new Set([...leftSet, ...rightSet]).size;

  return union === 0 ? 0 : intersection / union;
}

function getTextFingerprint(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}\u4e00-\u9fff]+/gu, "")
    .toLowerCase()
    .split("");
}

function layoutVisibleFragments(input: {
  fragments: DandelionFragmentFlowRecord[];
  currentTopic?: Node<InspirationFlowNodeData>;
  occupiedNodes: Node<InspirationFlowNodeData>[];
  anchorPosition: { x: number; y: number };
}) {
  const activeTags = new Set(input.currentTopic?.data.tags ?? []);
  const occupiedRects = input.occupiedNodes.map(getEstimatedNodeRect);

  return input.fragments.map((fragment, index) => {
    const copy = formatFragmentCopy(fragment);
    const tags = extractIdeaTags(`${copy.title} ${copy.preview}`);
    const sharedTagCount = tags.filter((tag) => activeTags.has(tag)).length;
    const radius = sharedTagCount > 0 ? 520 : 720;
    const angle = getFragmentAngle(index, tags);
    const center = getNodeCenter(
      input.anchorPosition,
      NODE_SIZE.dandelion.width,
      NODE_SIZE.dandelion.height
    );
    const desiredPosition = {
      x: center.x + Math.cos(angle) * (radius + index * 24) - NODE_SIZE.fragment.width / 2,
      y: center.y + Math.sin(angle) * (radius + index * 18) - NODE_SIZE.fragment.height / 2
    };
    const position = avoidOverlap({
      position: desiredPosition,
      size: NODE_SIZE.fragment,
      angle,
      occupiedRects,
      paddingX: 44,
      paddingY: 32
    });

    occupiedRects.push({
      ...position,
      width: NODE_SIZE.fragment.width,
      height: NODE_SIZE.fragment.height
    });

    return {
      id: getFragmentNodeId(fragment.id),
      type: "fragment",
      draggable: false,
      position: {
        x: position.x,
        y: position.y
      },
      data: {
        title: copy.title,
        content: copy.preview,
        displayTitle: copy.title,
        summary: copy.preview.slice(0, 42),
        tags,
        visualSize: getNodeVisualSize({
          displayTitle: copy.title,
          summary: copy.preview,
          tags
        }),
        createdAt: fragment.createdAt,
        isCurrent: false,
        kind: "fragment" as const,
        sourceTitle: input.currentTopic?.data.displayTitle ?? "当前蒲公英",
        vibe: copy.vibe
      }
    };
  });
}

function getVisibleExtensionNodes(input: {
  nodes: Node<InspirationFlowNodeData>[];
  edges: Edge[];
  activeNodeId: string;
  maxExtensions: number;
}) {
  const descendantIds = getDescendantNodeIds(input.edges, input.activeNodeId);

  return input.nodes
    .filter(
      (node) =>
        node.data.kind === "extension" &&
        descendantIds.has(node.id) &&
        node.id !== input.activeNodeId
    )
    .sort((a, b) => a.data.createdAt.localeCompare(b.data.createdAt))
    .slice(0, input.maxExtensions);
}

function getVisibleFragments(input: {
  fragments: DandelionFragmentFlowRecord[];
  visibleFragmentIds?: string[];
}) {
  if (input.visibleFragmentIds) {
    const visibleIds = new Set(input.visibleFragmentIds);

    return input.fragments.filter((fragment) => visibleIds.has(fragment.id));
  }

  return input.fragments.slice(0, 3);
}

function getNodeVisualSize(input: {
  displayTitle: string;
  summary: string;
  tags: string[];
}): InspirationFlowNodeData["visualSize"] {
  if (input.summary.length > 30 || input.tags.length >= 4) {
    return "tall";
  }

  if (input.displayTitle.length > 10 || input.summary.length > 18) {
    return "wide";
  }

  return "compact";
}

function getDescendantNodeIds(edges: Edge[], activeNodeId: string) {
  const childrenByParent = new Map<string, string[]>();

  for (const edge of edges) {
    childrenByParent.set(edge.source, [
      ...(childrenByParent.get(edge.source) ?? []),
      edge.target
    ]);
  }

  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(activeNodeId) ?? [])];

  while (queue.length) {
    const nodeId = queue.shift()!;

    if (descendants.has(nodeId)) {
      continue;
    }

    descendants.add(nodeId);
    queue.push(...(childrenByParent.get(nodeId) ?? []));
  }

  return descendants;
}

function getFragmentNodeId(fragmentId: string) {
  return `fragment-${fragmentId}`;
}

function getFragmentAngle(index: number, tags: string[]) {
  const tagBias = getTagAngleBias(tags);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  return normalizeAngle(Math.PI * 0.86 + index * goldenAngle + tagBias);
}

function getTagAngleBias(tags: string[]) {
  const primary = tags[0] ?? "";
  const tagBias: Record<string, number> = {
    画布: -0.74,
    布局: -0.48,
    关系线: -0.18,
    延伸: 0.18,
    碎片: 0.62,
    相关度: 0.88,
    聚类: 1.15,
    视角: -1.1,
    交互: 1.42
  };

  return tagBias[primary] ?? ((hashText(primary) % 9) - 4) * 0.18;
}

function getTagSimilarity(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const left = new Set(a);
  const right = new Set(b);
  const intersection = [...left].filter((tag) => right.has(tag)).length;
  const union = new Set([...left, ...right]).size;

  return union === 0 ? 0 : intersection / union;
}

function createInferredClusterEdge(
  representativeNode: Node<InspirationFlowNodeData>,
  targetNode: Node<InspirationFlowNodeData>
) {
  const similarity = getNodeSimilarity(representativeNode.data, targetNode.data);
  const relationKind = getInferredRelationKind(similarity);

  return {
    id: `inferred-${representativeNode.id}-${targetNode.id}`,
    source: representativeNode.id,
    target: targetNode.id,
    type: "floating",
    zIndex: 1,
    ...getRelationVisualStyle(relationKind),
    data: {
      relationKind,
      inferred: true
    }
  };
}

function getInferredRelationKind(similarity: number): IdeaRelationKind {
  if (similarity >= 0.82) {
    return "derivation";
  }

  if (similarity >= 0.62) {
    return "support";
  }

  return "association";
}

function shouldKeepVisibleEdge(input: {
  edge: Edge;
  activeNodeId: string;
  clusterIdByNodeId: Map<string, string>;
  clusterSizes: Map<string, number>;
}) {
  const sourceClusterId = input.clusterIdByNodeId.get(input.edge.source);
  const targetClusterId = input.clusterIdByNodeId.get(input.edge.target);
  const targetClusterSize = targetClusterId
    ? input.clusterSizes.get(targetClusterId) ?? 1
    : 1;

  if (sourceClusterId && targetClusterId && sourceClusterId === targetClusterId) {
    return false;
  }

  if (
    input.edge.source === input.activeNodeId &&
    targetClusterId &&
    targetClusterSize > 1 &&
    input.edge.target !== targetClusterId
  ) {
    return false;
  }

  return true;
}

function avoidOverlap(input: {
  position: { x: number; y: number };
  size: { width: number; height: number };
  angle: number;
  occupiedRects: EstimatedRect[];
  paddingX: number;
  paddingY: number;
}) {
  const step = 74;
  let position = input.position;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rect = {
      ...position,
      width: input.size.width,
      height: input.size.height
    };

    if (
      input.occupiedRects.every(
        (occupiedRect) =>
          !estimatedRectOverlap(rect, occupiedRect, input.paddingX, input.paddingY)
      )
    ) {
      return position;
    }

    position = {
      x: position.x + Math.cos(input.angle) * step,
      y: position.y + Math.sin(input.angle) * step
    };
  }

  return position;
}

function getOverlapPenalty(
  rect: EstimatedRect,
  occupiedRects: EstimatedRect[],
  paddingX: number,
  paddingY: number
) {
  return occupiedRects.reduce(
    (penalty, occupiedRect) =>
      penalty +
      (estimatedRectOverlap(rect, occupiedRect, paddingX, paddingY) ? 100000 : 0),
    0
  );
}

function estimatedRectOverlap(
  a: EstimatedRect,
  b: EstimatedRect,
  paddingX: number,
  paddingY: number
) {
  const aCenter = getNodeCenter(a, a.width, a.height);
  const bCenter = getNodeCenter(b, b.width, b.height);

  return (
    Math.abs(aCenter.x - bCenter.x) < (a.width + b.width) / 2 + paddingX &&
    Math.abs(aCenter.y - bCenter.y) < (a.height + b.height) / 2 + paddingY
  );
}

function getEstimatedNodeRect(node: Node<InspirationFlowNodeData>) {
  const size = getNodeSize(node);

  return {
    ...node.position,
    width: size.width,
    height: size.height
  };
}

function getNodeSize(node: Node<InspirationFlowNodeData>) {
  if (node.data.kind === "dandelion") {
    return NODE_SIZE.dandelion;
  }

  if (node.data.kind === "fragment") {
    return NODE_SIZE.fragment;
  }

  return NODE_SIZE.extension[node.data.visualSize];
}

function getNodeCenter(
  position: { x: number; y: number },
  width: number,
  height: number
) {
  return {
    x: position.x + width / 2,
    y: position.y + height / 2
  };
}

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getExtensionAgeTone(index: number, total: number) {
  if (index < Math.max(1, Math.ceil(total * 0.25))) {
    return "old" as const;
  }

  if (index >= Math.max(1, Math.floor(total * 0.72))) {
    return "new" as const;
  }

  return "middle";
}

function normalizeAngle(angle: number) {
  const fullTurn = Math.PI * 2;
  let normalized = angle % fullTurn;

  if (normalized > Math.PI) {
    normalized -= fullTurn;
  }

  if (normalized < -Math.PI) {
    normalized += fullTurn;
  }

  return normalized;
}

function hashText(text: string) {
  let hash = 0;

  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}

export function getRelationVisualStyle(relationKind: IdeaRelationKind) {
  const baseLabelStyle = {
    fontSize: 11,
    fontWeight: 600
  };
  const labelBgStyle = {
    fill: "#fff8e8",
    fillOpacity: 0.78
  };

  switch (relationKind) {
    case "derivation":
      return {
        label: "推导",
        style: { stroke: "#6f7f3f", strokeWidth: 3, opacity: 0.78 },
        labelStyle: { ...baseLabelStyle, fill: "#4f5f2d" },
        labelBgStyle
      };
    case "association":
      return {
        label: "联想",
        style: {
          stroke: "#c9aa5a",
          strokeDasharray: "5 7",
          strokeWidth: 1.6,
          opacity: 0.68
        },
        labelStyle: { ...baseLabelStyle, fill: "#8c6f24" },
        labelBgStyle
      };
    case "support":
      return {
        label: "支撑",
        style: { stroke: "#5d8a65", strokeWidth: 2, opacity: 0.72 },
        labelStyle: { ...baseLabelStyle, fill: "#3f6f47" },
        labelBgStyle
      };
    case "conflict":
      return {
        label: "冲突",
        style: {
          stroke: "#ad5b45",
          strokeDasharray: "7 5",
          strokeWidth: 2,
          opacity: 0.72
        },
        labelStyle: { ...baseLabelStyle, fill: "#8f3f2d" },
        labelBgStyle
      };
    case "analogy":
      return {
        label: "类比",
        style: {
          stroke: "#6d8291",
          strokeDasharray: "2 5",
          strokeWidth: 1.8,
          opacity: 0.68
        },
        labelStyle: { ...baseLabelStyle, fill: "#526c7d" },
        labelBgStyle
      };
    case "capture":
      return {
        label: "捕捉自",
        style: {
          stroke: "#b8aa8a",
          strokeDasharray: "2 8",
          strokeWidth: 1.2,
          opacity: 0.5
        },
        labelStyle: { ...baseLabelStyle, fill: "#8b7b5f" },
        labelBgStyle
      };
    case "pending":
      return {
        label: "待判定",
        style: {
          stroke: "#9b9b8a",
          strokeDasharray: "3 7",
          strokeWidth: 1.2,
          opacity: 0.45
        },
        labelStyle: { ...baseLabelStyle, fill: "#777766" },
        labelBgStyle
      };
  }
}
