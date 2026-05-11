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
  lockedTag?: string | null;
  onTagHover?: (tag: string | null) => void;
  onTagClick?: (tag: string) => void;
};

export type IdeaRelationKind =
  | "derivation"
  | "association"
  | "support"
  | "conflict"
  | "analogy"
  | "capture"
  | "pending";

export type IdeaRelationRecord = {
  sourceNodeId: string;
  targetNodeId: string;
  relationKind: IdeaRelationKind;
  strength?: number | null;
};

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

type LayoutRelation = IdeaRelationRecord & {
  strength: number;
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
  relations?: IdeaRelationRecord[];
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
        currentTopic,
        edges: input.graph.edges,
        relations: input.relations ?? [],
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
  const visibleTopicEdges = input.graph.edges
    .filter(
      (edge) =>
        visibleTopicIds.has(edge.source) &&
        visibleTopicIds.has(edge.target) &&
        shouldKeepVisibleEdge({
          edge,
          activeNodeId: currentTopic?.id ?? input.activeNodeId,
          clusterIdByNodeId: extensionLayout.clusterIdByNodeId,
          clusterSizes: extensionLayout.clusterSizes
        })
    )
    .map((edge) => applyRelationOverride(edge, input.relations ?? []));

  return {
    nodes: [...topicNodes, ...fragmentNodes],
    edges: [...visibleTopicEdges, ...extensionLayout.inferredEdges]
  };
}

function layoutVisibleExtensions(input: {
  nodes: Node<InspirationFlowNodeData>[];
  currentTopic: Node<InspirationFlowNodeData>;
  edges: Edge[];
  relations: IdeaRelationRecord[];
  activeNodeId: string;
  anchorPosition: { x: number; y: number };
}): ExtensionLayout {
  const total = input.nodes.length;
  const anchorCenter = getNodeCenter(
    input.anchorPosition,
    NODE_SIZE.dandelion.width,
    NODE_SIZE.dandelion.height
  );
  const rootData = input.currentTopic.data;
  const rootTags = rootData.tags;
  const layoutRelations = normalizeLayoutRelations(input.relations);
  const relationStrengthByPair = buildRelationStrengthByPair(layoutRelations);
  const centerStrengthByNodeId = buildCenterStrengthByNodeId({
    activeNodeId: input.activeNodeId,
    relations: layoutRelations
  });
  const groups = groupExtensionsBySimilarity(input.nodes, relationStrengthByPair);
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
    const representative = getGroupRepresentative(group, rootTags);
    const groupAngle = getGroupAngle({
      group,
      representative,
      groupIndex,
      totalGroups: groups.length,
      placedGroups: placedNodes,
      anchorCenter
    });
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
      const inferredCenterSimilarity = getNodeSimilarity(rootData, node.data);
      const centerSimilarity = Math.max(
        inferredCenterSimilarity,
        centerStrengthByNodeId.get(node.id) ?? 0
      );
      const ageIndex = input.nodes.findIndex((candidate) => candidate.id === node.id);
      const targetRadius =
        300 +
        (1 - centerSimilarity) * 340 +
        Math.max(ageIndex, 0) * 8 +
        (node.id === representative.id ? 0 : indexInGroup * 34);
      const angle =
        groupAngle +
        getGroupSpreadOffset({
          index: indexInGroup,
          total: orderedGroup.length,
          strength:
            node.id === representative.id
              ? 1
              : getPairRelationStrength(
                  relationStrengthByPair,
                  representative.id,
                  node.id
                )
        }) +
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
        node,
        relationStrengthByPair
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
        inferredEdges.push(
          createInferredClusterEdge(representative, node, input.relations)
        );
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

function groupExtensionsBySimilarity(
  nodes: Node<InspirationFlowNodeData>[],
  relationStrengthByPair: Map<string, number>
) {
  const groups: ExtensionGroup[] = [];

  for (const node of nodes) {
    let bestGroupIndex = -1;
    let bestScore = 0;

    for (const [index, group] of groups.entries()) {
      const score = Math.max(
        ...group.members.map((member) =>
          Math.max(
            getNodeSimilarity(member.data, node.data),
            getPairRelationStrength(relationStrengthByPair, member.id, node.id)
          )
        )
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

function getGroupAngle(input: {
  group: ExtensionGroup;
  representative: Node<InspirationFlowNodeData>;
  groupIndex: number;
  totalGroups: number;
  placedGroups: Node<InspirationFlowNodeData>[];
  anchorCenter: { x: number; y: number };
}) {
  const {
    group,
    representative,
    groupIndex,
    totalGroups,
    placedGroups,
    anchorCenter
  } = input;
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

  const ringAngles = getGroupAngleCandidates(groupIndex, totalGroups);
  const relatedAngles = placedGroups.flatMap((placedNode) => {
    const similarity = getNodeSimilarity(representative.data, placedNode.data);

    if (similarity < 0.12) {
      return [];
    }

    const placedCenter = getNodeCenter(
      placedNode.position,
      getNodeSize(placedNode).width,
      getNodeSize(placedNode).height
    );
    const placedAngle = Math.atan2(
      placedCenter.y - anchorCenter.y,
      placedCenter.x - anchorCenter.x
    );
    const offset = 0.34 + (1 - similarity) * 0.28;

    return [normalizeAngle(placedAngle - offset), normalizeAngle(placedAngle + offset)];
  });
  const candidates = [...relatedAngles, ...ringAngles];

  return candidates
    .map((angle) => ({
      angle,
      score: getGroupAngleScore(angle, representative, placedGroups, anchorCenter)
    }))
    .sort((a, b) => a.score - b.score)[0]?.angle ??
    normalizeAngle(-0.9 + (Math.PI * 2 * groupIndex) / Math.max(totalGroups, 1));
}

function getGroupAngleCandidates(groupIndex: number, totalGroups: number) {
  if (totalGroups <= 1) {
    return [-0.28];
  }

  if (totalGroups <= 6) {
    const span = Math.PI * 0.82;
    const start = -span / 2;

    return Array.from({ length: totalGroups }, (_, index) =>
      normalizeAngle(start + (span * index) / Math.max(totalGroups - 1, 1))
    );
  }

  return Array.from({ length: Math.max(totalGroups * 2, 9) }, (_, index) =>
    normalizeAngle(-1.15 + (Math.PI * 1.35 * index) / Math.max(totalGroups * 2 - 1, 1))
  );
}

function getGroupAngleScore(
  angle: number,
  representative: Node<InspirationFlowNodeData>,
  placedGroups: Node<InspirationFlowNodeData>[],
  anchorCenter: { x: number; y: number }
) {
  return placedGroups.reduce((score, placedNode) => {
    const placedCenter = getNodeCenter(
      placedNode.position,
      getNodeSize(placedNode).width,
      getNodeSize(placedNode).height
    );
    const placedAngle = Math.atan2(
      placedCenter.y - anchorCenter.y,
      placedCenter.x - anchorCenter.x
    );
    const angularDistance = getAngularDistance(angle, placedAngle);
    const similarity = getNodeSimilarity(representative.data, placedNode.data);

    if (similarity >= 0.12) {
      const targetDistance = 0.34 + (1 - similarity) * 0.38;

      return score + Math.abs(angularDistance - targetDistance) * similarity * 220;
    }

    return score + Math.max(0, 0.95 - angularDistance) * 120;
  }, 0);
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

function getGroupSpreadOffset(input: {
  index: number;
  total: number;
  strength: number;
}) {
  const { index, total, strength } = input;

  if (total <= 1) {
    return 0;
  }

  const compressedSpread = 0.12 + (1 - clamp01(strength)) * 0.22;

  return (index - (total - 1) / 2) * compressedSpread;
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
  relationStrengthByPair: Map<string, number>;
}) {
  const candidates = getLayoutCandidates({
    desiredPosition: input.desiredPosition,
    size: input.size,
    angle: input.angle,
    radius: input.radius,
    anchorCenter: input.anchorCenter,
    placedNodes: input.placedNodes,
    node: input.node,
    relationStrengthByPair: input.relationStrengthByPair
  }).map((position) => {
    const rect = { ...position, ...input.size };

    return {
      position,
      score:
        getOverlapPenalty(rect, input.occupiedRects, 54, 40) +
        getSemanticDistancePenalty(
          input.node,
          position,
          input.placedNodes,
          input.relationStrengthByPair
        ) +
        getDistance(
          getNodeCenter(position, input.size.width, input.size.height),
          input.anchorCenter
        ) *
          0.03 +
        getDistance(position, input.desiredPosition) *
          getDesiredPositionWeight(input.node, position, input.placedNodes, input.relationStrengthByPair)
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
  placedNodes?: Node<InspirationFlowNodeData>[];
  node?: Node<InspirationFlowNodeData>;
  relationStrengthByPair?: Map<string, number>;
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

  if (input.placedNodes && input.node && input.relationStrengthByPair) {
    candidates.push(
      ...getRelatedNodeCandidates({
        node: input.node,
        size: input.size,
        placedNodes: input.placedNodes,
        anchorCenter: input.anchorCenter,
        relationStrengthByPair: input.relationStrengthByPair
      })
    );
  }

  candidates.push(input.desiredPosition);

  return candidates;
}

function getRelatedNodeCandidates(input: {
  node: Node<InspirationFlowNodeData>;
  size: { width: number; height: number };
  placedNodes: Node<InspirationFlowNodeData>[];
  anchorCenter: { x: number; y: number };
  relationStrengthByPair: Map<string, number>;
}) {
  return input.placedNodes
    .map((placedNode) => ({
      node: placedNode,
      similarity: Math.max(
        getNodeSimilarity(input.node.data, placedNode.data),
        getPairRelationStrength(
          input.relationStrengthByPair,
          input.node.id,
          placedNode.id
        )
      )
    }))
    .filter((entry) => entry.similarity >= 0.2)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 2)
    .flatMap((entry) => {
      const placedSize = getNodeSize(entry.node);
      const placedCenter = getNodeCenter(
        entry.node.position,
        placedSize.width,
        placedSize.height
      );
      const outwardAngle = Math.atan2(
        placedCenter.y - input.anchorCenter.y,
        placedCenter.x - input.anchorCenter.x
      );
      const tangentAngle = outwardAngle + Math.PI / 2;
      const targetGap = 34 + (1 - entry.similarity) * 38;
      const centerDistance =
        (placedSize.width + input.size.width) / 2 + targetGap;
      const candidates: Array<{ x: number; y: number }> = [];

      for (const angle of [
        tangentAngle,
        tangentAngle + Math.PI,
        outwardAngle + 0.42,
        outwardAngle - 0.42
      ]) {
        candidates.push({
          x: placedCenter.x + Math.cos(angle) * centerDistance - input.size.width / 2,
          y: placedCenter.y + Math.sin(angle) * centerDistance - input.size.height / 2
        });
      }

      return candidates;
    });
}

function getDesiredPositionWeight(
  node: Node<InspirationFlowNodeData>,
  position: { x: number; y: number },
  placedNodes: Node<InspirationFlowNodeData>[],
  relationStrengthByPair: Map<string, number>
) {
  const nodeSize = getNodeSize(node);
  const center = getNodeCenter(position, nodeSize.width, nodeSize.height);
  const strongestNearbySimilarity = placedNodes.reduce((strongest, placedNode) => {
    const placedSize = getNodeSize(placedNode);
    const placedCenter = getNodeCenter(
      placedNode.position,
      placedSize.width,
      placedSize.height
    );
    const similarity = Math.max(
      getNodeSimilarity(node.data, placedNode.data),
      getPairRelationStrength(relationStrengthByPair, node.id, placedNode.id)
    );
    const distance = getDistance(center, placedCenter);
    const relatedDistance =
      (nodeSize.width + placedSize.width) / 2 + 140;

    if (similarity < 0.2 || distance > relatedDistance) {
      return strongest;
    }

    return Math.max(strongest, similarity);
  }, 0);

  return strongestNearbySimilarity > 0
    ? 0.18 + (1 - strongestNearbySimilarity) * 0.24
    : 0.7;
}

function getSemanticDistancePenalty(
  node: Node<InspirationFlowNodeData>,
  position: { x: number; y: number },
  placedNodes: Node<InspirationFlowNodeData>[],
  relationStrengthByPair: Map<string, number>
) {
  const nodeSize = getNodeSize(node);
  const center = getNodeCenter(position, nodeSize.width, nodeSize.height);

  return placedNodes.reduce((penalty, placedNode) => {
    const similarity = Math.max(
      getNodeSimilarity(node.data, placedNode.data),
      getPairRelationStrength(relationStrengthByPair, node.id, placedNode.id)
    );

    if (similarity <= 0.08) {
      return penalty;
    }

    const placedSize = getNodeSize(placedNode);
    const placedCenter = getNodeCenter(
      placedNode.position,
      placedSize.width,
      placedSize.height
    );
    const distance = getDistance(center, placedCenter);
    const targetDistance = 330 - similarity * 170;

    return penalty + Math.abs(distance - targetDistance) * similarity * 2.4;
  }, 0);
}

function getNodeSimilarity(
  a: Pick<InspirationFlowNodeData, "tags" | "displayTitle" | "summary">,
  b: Pick<InspirationFlowNodeData, "tags" | "displayTitle" | "summary">
) {
  const leftCopy = getNormalizedIdeaCopy(a);
  const rightCopy = getNormalizedIdeaCopy(b);

  if (leftCopy && leftCopy === rightCopy) {
    return 1;
  }

  const tagSimilarity = getTagSimilarity(a.tags, b.tags);
  const textSimilarity = getTextSimilarity(
    `${a.displayTitle} ${a.summary}`,
    `${b.displayTitle} ${b.summary}`
  );
  const phraseSimilarity = getPhraseSimilarity(
    `${a.displayTitle} ${a.summary}`,
    `${b.displayTitle} ${b.summary}`
  );
  const conceptSimilarity = getConceptSimilarity(
    `${a.displayTitle} ${a.summary}`,
    `${b.displayTitle} ${b.summary}`
  );

  const blendedSimilarity =
    tagSimilarity * 0.34 +
    textSimilarity * 0.24 +
    phraseSimilarity * 0.22 +
    conceptSimilarity * 0.2;

  if (textSimilarity >= 0.92) {
    return Math.max(blendedSimilarity, 0.86);
  }

  if (textSimilarity >= 0.82) {
    return Math.max(blendedSimilarity, 0.72);
  }

  if (conceptSimilarity >= 0.28) {
    return Math.max(blendedSimilarity, 0.42);
  }

  if (phraseSimilarity >= 0.26) {
    return Math.max(blendedSimilarity, 0.46);
  }

  return blendedSimilarity;
}

function getPhraseSimilarity(a: string, b: string) {
  const left = new Set(getPhraseTokens(a));
  const right = new Set(getPhraseTokens(b));

  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;

  return union === 0 ? 0 : intersection / union;
}

function getPhraseTokens(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}\u4e00-\u9fff]+/gu, "");
  const tokens = new Set<string>();

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const token = normalized.slice(index, index + 2);

    if (!isLowSignalToken(token)) {
      tokens.add(token);
    }
  }

  return [...tokens];
}

function isLowSignalToken(token: string) {
  return /^(这个|那个|当前|一个|用户|知道|可以|直接|之后|讨论|需要|想法)$/u.test(
    token
  );
}

function normalizeLayoutRelations(relations: IdeaRelationRecord[]) {
  return relations.map((relation) => ({
    ...relation,
    strength: clamp01(
      relation.strength ??
        relationKindToStrength(relation.relationKind)
    )
  }));
}

function buildRelationStrengthByPair(relations: LayoutRelation[]) {
  const map = new Map<string, number>();

  for (const relation of relations) {
    const key = getRelationPairKey(relation.sourceNodeId, relation.targetNodeId);
    const reverseKey = getRelationPairKey(relation.targetNodeId, relation.sourceNodeId);
    const current = map.get(key) ?? 0;

    map.set(key, Math.max(current, relation.strength));
    map.set(reverseKey, Math.max(map.get(reverseKey) ?? 0, relation.strength));
  }

  return map;
}

function buildCenterStrengthByNodeId(input: {
  activeNodeId: string;
  relations: LayoutRelation[];
}) {
  const map = new Map<string, number>();

  for (const relation of input.relations) {
    if (
      relation.sourceNodeId === input.activeNodeId &&
      relation.targetNodeId !== input.activeNodeId
    ) {
      const current = map.get(relation.targetNodeId) ?? 0;
      map.set(relation.targetNodeId, Math.max(current, relation.strength));
    }
  }

  return map;
}

function getPairRelationStrength(
  relationStrengthByPair: Map<string, number>,
  leftId: string,
  rightId: string
) {
  return relationStrengthByPair.get(getRelationPairKey(leftId, rightId)) ?? 0;
}

function getRelationPairKey(leftId: string, rightId: string) {
  return `${leftId}::${rightId}`;
}

function relationKindToStrength(kind: IdeaRelationKind) {
  switch (kind) {
    case "derivation":
      return 1;
    case "support":
      return 0.82;
    case "analogy":
      return 0.7;
    case "association":
      return 0.56;
    case "conflict":
      return 0.48;
    case "pending":
      return 0.28;
    case "capture":
    default:
      return 0;
  }
}

function getConceptSimilarity(a: string, b: string) {
  const left = new Set(getConceptTokens(a));
  const right = new Set(getConceptTokens(b));

  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  const domainBoost = getSharedConceptDomain(left, right) ? 0.24 : 0;

  return Math.min(1, (union === 0 ? 0 : intersection / union) + domainBoost);
}

function getConceptTokens(value: string) {
  const normalized = value.normalize("NFKC").toLowerCase();
  const tokens = [
    "宏观",
    "微观",
    "学习",
    "框架",
    "步骤",
    "目标",
    "边界",
    "练习",
    "反馈",
    "入口",
    "开场",
    "开始",
    "提示",
    "引导",
    "体验",
    "画布",
    "连线",
    "关系",
    "布局",
    "中心",
    "延伸",
    "碎片",
    "标题",
    "文案",
    "聚类",
    "合并",
    "视角"
  ];

  return tokens.filter((token) => normalized.includes(token));
}

function getSharedConceptDomain(left: Set<string>, right: Set<string>) {
  const domains = [
    ["宏观", "微观", "学习", "框架", "步骤", "目标", "练习", "反馈"],
    ["入口", "开场", "开始", "提示", "引导", "体验"],
    ["画布", "连线", "关系", "布局", "中心", "延伸", "碎片"],
    ["标题", "文案", "归纳"],
    ["聚类", "合并"]
  ];

  return domains.some(
    (domain) =>
      domain.some((token) => left.has(token)) &&
      domain.some((token) => right.has(token))
  );
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

function getNormalizedIdeaCopy(
  data: Pick<InspirationFlowNodeData, "displayTitle" | "summary">
) {
  return `${data.displayTitle} ${data.summary}`
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
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
  targetNode: Node<InspirationFlowNodeData>,
  relations: IdeaRelationRecord[]
) {
  const similarity = getNodeSimilarity(representativeNode.data, targetNode.data);
  const userRelation = findRelationOverride(
    relations,
    representativeNode.id,
    targetNode.id
  );
  const relationKind =
    userRelation?.relationKind ?? getInferredRelationKind(similarity);
  const strength =
    userRelation?.strength ??
    relationKindToStrength(relationKind) ??
    similarity;

  return {
    id: `inferred-${representativeNode.id}-${targetNode.id}`,
    source: representativeNode.id,
    target: targetNode.id,
    type: "floating",
    zIndex: 1,
    ...getRelationVisualStyle(relationKind),
    data: {
      relationKind,
      inferred: true,
      userEdited: Boolean(userRelation),
      strength
    }
  };
}

function findRelationOverride(
  relations: IdeaRelationRecord[],
  sourceNodeId: string,
  targetNodeId: string
) {
  return relations.find(
    (relation) =>
      relation.sourceNodeId === sourceNodeId &&
      relation.targetNodeId === targetNodeId
  );
}

function applyRelationOverride(edge: Edge, relations: IdeaRelationRecord[]) {
  const userRelation = findRelationOverride(relations, edge.source, edge.target);

  if (!userRelation) {
    return edge;
  }

  return {
    ...edge,
    ...getRelationVisualStyle(userRelation.relationKind),
    data: {
      ...edge.data,
      relationKind: userRelation.relationKind,
      userEdited: true
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

function getAngularDistance(a: number, b: number) {
  return Math.abs(normalizeAngle(a - b));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
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
