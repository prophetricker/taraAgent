"use client";

import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  Position,
  ReactFlow,
  getBezierPath,
  useInternalNode,
  useStore,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeProps,
  type NodeChange,
  type Node,
  type NodeProps,
  type ReactFlowInstance
} from "@xyflow/react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DandelionFragmentRecord } from "@/db/queries";
import {
  clearCanvasSelection,
  getEffectiveHighlightedTag,
  getRelationMenuPosition,
  isTagLocked,
  toggleLockedTag
} from "@/lib/canvas-interactions";
import type { DatabaseHealth } from "@/lib/database-health";
import { getFloatingEdgeGeometry } from "@/lib/floating-edge";
import { formatFragmentCopy } from "@/lib/fragments";
import { buildRightBrainGraph, getRelationVisualStyle } from "@/lib/graph";
import type {
  IdeaRelationKind,
  IdeaRelationRecord,
  InspirationFlowNodeData
} from "@/lib/graph";
import {
  getCanvasOnboardingCards,
  shouldShowCanvasOnboarding
} from "@/lib/onboarding";
import {
  getSaveStatusCopy,
  getSaveStatusToneClass,
  shouldShowSaveStatus,
  type SaveStatus
} from "@/lib/save-status";

const ClientOnlyFlow = dynamic(
  () => Promise.resolve(FlowSurface),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-[#e9e2ce]/35" aria-hidden="true" />
    )
  }
);

export function InspirationCanvas({
  activeNodeId,
  graph,
  relations,
  fragments,
  databaseHealth,
  notice,
  saveStatus,
  onNoticeDismiss,
  onNodePositionChange,
  onRelationChange
}: {
  activeNodeId: string;
  graph: {
    nodes: Node<InspirationFlowNodeData>[];
    edges: Edge[];
  };
  relations: IdeaRelationRecord[];
  fragments: DandelionFragmentRecord[];
  databaseHealth: DatabaseHealth;
  notice: string | null;
  saveStatus: SaveStatus | null;
  onNoticeDismiss: () => void;
  onNodePositionChange: (
    nodeId: string,
    position: { x: number; y: number }
  ) => Promise<void>;
  onRelationChange: (input: {
    sourceNodeId: string;
    targetNodeId: string;
    relationKind: IdeaRelationKind;
  }) => Promise<boolean>;
}) {
  const [visibleFragmentIds, setVisibleFragmentIds] = useState<
    string[] | undefined
  >();
  const [isFragmentPoolOpen, setIsFragmentPoolOpen] = useState(false);
  const flowGraph = useMemo(
    () =>
      buildRightBrainGraph({
        graph,
        activeNodeId,
        fragments,
        relations,
        visibleFragmentIds
      }),
    [activeNodeId, fragments, graph, relations, visibleFragmentIds]
  );
  const showOnboarding = shouldShowCanvasOnboarding({
    extensionCount: flowGraph.nodes.filter(
      (node) => node.data.kind === "extension"
    ).length,
    fragmentCount: fragments.length
  });
  const [nodes, setNodes, onNodesChange] = useNodesState(flowGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowGraph.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<{
    edgeId: string;
    sourceNodeId: string;
    targetNodeId: string;
    relationKind: IdeaRelationKind;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [lockedTag, setLockedTag] = useState<string | null>(null);
  const highlightedTag = getEffectiveHighlightedTag({
    hoveredTag,
    lockedTag
  });
  const flowInstanceRef = useRef<ReactFlowInstance<
    Node<InspirationFlowNodeData>,
    Edge
  > | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeTypes = useMemo(
    () => ({
      topic: TopicNode,
      fragment: FragmentNode
    }),
    []
  );
  const edgeTypes = useMemo(
    () => ({
      floating: FloatingEdge
    }),
    []
  );

  useEffect(() => {
    setNodes((currentNodes) =>
      flowGraph.nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
        data: {
          ...node.data,
          lockedTag,
          onTagHover: setHoveredTag,
          onTagClick: (tag: string) =>
            setLockedTag((current) => toggleLockedTag(current, tag))
        },
        position:
          node.data.kind === "dandelion"
            ? currentNodes.find((currentNode) => currentNode.id === node.id)
                ?.position ?? node.position
            : node.position
      }))
    );
    setEdges(flowGraph.edges);
  }, [flowGraph, lockedTag, selectedNodeId, setEdges, setNodes]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void flowInstanceRef.current?.fitView({
        duration: 420,
        padding: 0.22
      });
    }, 60);

    return () => window.clearTimeout(timer);
  }, [flowGraph.nodes.length, fragments.length]);

  function handleNodesChange(changes: NodeChange<Node<InspirationFlowNodeData>>[]) {
    onNodesChange(changes);
  }

  async function handleRelationKindChange(relationKind: IdeaRelationKind) {
    if (!selectedRelation) {
      return;
    }

    const relation = selectedRelation;
    setSelectedRelation(null);
    const previousEdges = edges;
    const relationStyle = getRelationVisualStyle(relationKind);
    setEdges((currentEdges) =>
      currentEdges.map((edge) =>
        edge.id === relation.edgeId
          ? {
              ...edge,
              ...relationStyle,
              data: {
                ...edge.data,
                relationKind,
                userEdited: true
              }
            }
          : edge
      )
    );
    const saved = await onRelationChange({
      sourceNodeId: relation.sourceNodeId,
      targetNodeId: relation.targetNodeId,
      relationKind
    });

    if (!saved) {
      setEdges(previousEdges);
    }
  }

  return (
    <div
      ref={canvasRef}
      className="h-full w-full"
      data-highlighted-tag={highlightedTag ?? undefined}
    >
      <div className="absolute left-6 top-5 z-10 rounded-3xl bg-[#fff8e8]/75 px-5 py-4 shadow-lg shadow-stone-900/10 backdrop-blur">
        <p className="text-xs tracking-[0.28em] text-[#667a4d]">
          DANDELION GRAPH
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-[#2c241b]">
          当前蒲公英图
        </h2>
      </div>
      <CanvasNotice
        notice={
          notice ??
          (!databaseHealth.ok
            ? `数据库迁移未完成：请执行 ${databaseHealth.requiredMigrations.join(", ")}`
            : null)
        }
        onDismiss={onNoticeDismiss}
      />
      <SaveStatusPill status={saveStatus} />
      <CanvasOnboarding show={showOnboarding} />
      <FragmentPool
        fragments={fragments}
        visibleFragmentIds={visibleFragmentIds}
        isOpen={isFragmentPoolOpen}
        onToggleOpen={() => setIsFragmentPoolOpen((current) => !current)}
        onHideAll={() => setVisibleFragmentIds([])}
        onShowRecent={() =>
          setVisibleFragmentIds(
            fragments.slice(0, 3).map((fragment) => fragment.id)
          )
        }
        onToggleFragment={(fragmentId) => {
          setVisibleFragmentIds((current) => {
            const visible =
              current ?? fragments.slice(0, 3).map((fragment) => fragment.id);

            return visible.includes(fragmentId)
              ? visible.filter((id) => id !== fragmentId)
              : [...visible, fragmentId];
          });
        }}
      />
      <ClientOnlyFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onEdgeClick={(event, edge) => {
          event.stopPropagation();
          const relationKind = edge.data?.relationKind;

          if (!isEditableRelationKind(relationKind)) {
            return;
          }
          const canvasRect = canvasRef.current?.getBoundingClientRect();

          setSelectedRelation({
            edgeId: edge.id,
            sourceNodeId: edge.source,
            targetNodeId: edge.target,
            relationKind,
            ...getRelationMenuPosition({
              anchorX: event.clientX,
              anchorY: event.clientY,
              viewportWidth: canvasRect?.width ?? window.innerWidth,
              viewportHeight: canvasRect?.height ?? window.innerHeight,
              containerLeft: canvasRect?.left ?? 0,
              containerTop: canvasRect?.top ?? 0
            })
          });
        }}
        onPaneClick={() => {
          setSelectedNodeId(null);
          setSelectedRelation(null);
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          const cleared = clearCanvasSelection();

          setSelectedNodeId(cleared.selectedNodeId);
          setSelectedRelation(cleared.selectedRelation);
          setHoveredTag(cleared.hoveredTag);
          setLockedTag(cleared.lockedTag);
        }}
        onInit={(instance) => {
          flowInstanceRef.current = instance;
        }}
        onNodeDragStop={(_, node) => {
          if (node.data.kind !== "dandelion") {
            return;
          }

          void onNodePositionChange(node.id, node.position);
        }}
      />
      <RelationEditor
        relation={selectedRelation}
        onChange={handleRelationKindChange}
        onClose={() => setSelectedRelation(null)}
      />
    </div>
  );
}

function CanvasOnboarding({ show }: { show: boolean }) {
  const cards = getCanvasOnboardingCards();

  if (!show) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute bottom-6 left-6 z-10 max-w-[34rem] rounded-[1.6rem] border border-stone-900/10 bg-[#fff8e8]/78 p-4 shadow-xl shadow-stone-900/10 backdrop-blur">
      <p className="text-[10px] font-semibold tracking-[0.24em] text-[#667a4d]">
        HOW TO READ
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-[1.15rem] border border-[#667a4d]/12 bg-white/45 p-3"
          >
            <h3 className="text-sm font-semibold text-[#2c241b]">
              {card.title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-stone-600">{card.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveStatusPill({ status }: { status: SaveStatus | null }) {
  if (!shouldShowSaveStatus(status)) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-[4.2rem] z-40 -translate-x-1/2 rounded-full border px-4 py-2 text-xs shadow-lg shadow-stone-900/10 backdrop-blur transition ${getSaveStatusToneClass(status)}`}
    >
      {getSaveStatusCopy(status)}
    </div>
  );
}

function CanvasNotice({
  notice,
  onDismiss
}: {
  notice: string | null;
  onDismiss: () => void;
}) {
  if (!notice) {
    return null;
  }

  return (
    <div className="absolute left-1/2 top-5 z-40 flex max-w-[min(38rem,72%)] -translate-x-1/2 items-center gap-3 rounded-full border border-amber-700/20 bg-[#fff8e8]/88 px-4 py-2 text-xs text-amber-900 shadow-lg shadow-stone-900/10 backdrop-blur">
      <span className="truncate">{notice}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-full px-2 py-1 text-amber-900/70 hover:bg-amber-900/10"
      >
        关闭
      </button>
    </div>
  );
}

function FlowSurface({
  nodes,
  edges,
  nodeTypes,
  edgeTypes,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  onPaneContextMenu,
  onInit,
  onNodeDragStop
}: {
  nodes: Node<InspirationFlowNodeData>[];
  edges: Edge[];
  nodeTypes: {
    topic: typeof TopicNode;
    fragment: typeof FragmentNode;
  };
  edgeTypes: {
    floating: typeof FloatingEdge;
  };
  onNodesChange: (changes: NodeChange<Node<InspirationFlowNodeData>>[]) => void;
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  onNodeClick: (
    event: React.MouseEvent,
    node: Node<InspirationFlowNodeData>
  ) => void;
  onEdgeClick: (event: React.MouseEvent, edge: Edge) => void;
  onPaneClick: () => void;
  onPaneContextMenu: (
    event: MouseEvent | React.MouseEvent<Element, MouseEvent>
  ) => void;
  onInit: (instance: ReactFlowInstance<Node<InspirationFlowNodeData>, Edge>) => void;
  onNodeDragStop: (
    event: React.MouseEvent,
    node: Node<InspirationFlowNodeData>
  ) => void;
}) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onPaneClick={onPaneClick}
      onPaneContextMenu={onPaneContextMenu}
      onInit={onInit}
      onNodeDragStop={onNodeDragStop}
      fitView
      fitViewOptions={{ padding: 0.22 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#9aaa83" gap={28} size={1} />
      <Controls />
    </ReactFlow>
  );
}

const RELATION_OPTIONS: Array<{
  value: IdeaRelationKind;
  label: string;
  description: string;
}> = [
  { value: "derivation", label: "推导", description: "由前一个想法推出" },
  { value: "association", label: "联想", description: "横向跳出的相关想法" },
  { value: "support", label: "支撑", description: "补充依据或背景" },
  { value: "conflict", label: "冲突", description: "张力、矛盾或反例" },
  { value: "analogy", label: "类比", description: "结构相似的参照" },
  { value: "pending", label: "待判定", description: "先保留关系，不急着定性" }
];

function RelationEditor({
  relation,
  onChange,
  onClose
}: {
  relation: {
    relationKind: IdeaRelationKind;
    x: number;
    y: number;
  } | null;
  onChange: (relationKind: IdeaRelationKind) => void;
  onClose: () => void;
}) {
  if (!relation) {
    return null;
  }

  return (
    <div
      className="absolute z-50 w-72 rounded-[1.3rem] border border-stone-900/10 bg-[#fff8e8]/95 p-3 shadow-2xl shadow-stone-900/15 backdrop-blur"
      style={{
        left: relation.x,
        top: relation.y
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.24em] text-[#667a4d]">
          关系校正
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-2 py-1 text-xs text-stone-500 hover:bg-stone-900/5"
        >
          关闭
        </button>
      </div>
      <div className="grid gap-1.5">
        {RELATION_OPTIONS.map((option) => {
          const selected = option.value === relation.relationKind;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-2xl px-3 py-2 text-left transition ${
                selected
                  ? "bg-[#667a4d] text-[#fff8e8]"
                  : "bg-white/45 text-[#2c241b] hover:bg-white/70"
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span
                className={`mt-0.5 block text-xs ${
                  selected ? "text-[#fff8e8]/75" : "text-stone-500"
                }`}
              >
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function isEditableRelationKind(value: unknown): value is IdeaRelationKind {
  return (
    value === "derivation" ||
    value === "association" ||
    value === "support" ||
    value === "conflict" ||
    value === "analogy" ||
    value === "pending"
  );
}

function FloatingEdge(props: EdgeProps) {
  const sourceNode = useInternalNode<Node<InspirationFlowNodeData>>(props.source);
  const targetNode = useInternalNode<Node<InspirationFlowNodeData>>(props.target);
  const obstacleRects = useStore((store) =>
    Array.from(store.nodeLookup.values())
      .filter((node) => node.id !== props.source && node.id !== props.target)
      .map((node) => getInternalNodeRect(node as unknown as CanvasInternalNode))
  );

  if (!sourceNode || !targetNode) {
    const [edgePath, labelX, labelY] = getBezierPath(props);

    return (
      <BaseEdge
        id={props.id}
        path={edgePath}
        labelX={labelX}
        labelY={labelY}
        label={props.label}
        labelStyle={props.labelStyle}
        labelBgStyle={props.labelBgStyle}
        labelShowBg={props.labelShowBg}
        labelBgPadding={props.labelBgPadding}
        labelBgBorderRadius={props.labelBgBorderRadius}
        style={props.style}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
        interactionWidth={props.interactionWidth}
      />
    );
  }

  const sourceRect = getInternalNodeRect(sourceNode);
  const targetRect = getInternalNodeRect(targetNode);
  const geometry = getFloatingEdgeGeometry(sourceRect, targetRect, {
    obstacles: obstacleRects
  });

  return (
    <BaseEdge
      id={props.id}
      path={geometry.path}
      labelX={geometry.labelX}
      labelY={geometry.labelY}
      label={props.label}
      labelStyle={props.labelStyle}
      labelBgStyle={props.labelBgStyle}
      labelShowBg={props.labelShowBg}
      labelBgPadding={props.labelBgPadding}
      labelBgBorderRadius={props.labelBgBorderRadius}
      style={props.style}
      markerStart={props.markerStart}
      markerEnd={props.markerEnd}
      interactionWidth={props.interactionWidth}
    />
  );
}

type CanvasInternalNode = Parameters<typeof getInternalNodeRect>[0] & {
  id: string;
};

function getInternalNodeRect(node: {
  data: InspirationFlowNodeData;
  internals: { positionAbsolute: { x: number; y: number } };
  measured: { width?: number; height?: number };
  width?: number;
  height?: number;
}) {
  const fallbackSize = getRenderedNodeSize(node.data);

  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? node.width ?? fallbackSize.width,
    height: node.measured.height ?? node.height ?? fallbackSize.height
  };
}

function getRenderedNodeSize(data: InspirationFlowNodeData) {
  switch (data.kind) {
    case "dandelion":
      return { width: 368, height: 220 };
    case "fragment":
      return { width: 224, height: 144 };
    case "extension":
    default:
      return data.visualSize === "compact"
        ? { width: 240, height: 140 }
        : data.visualSize === "wide"
          ? { width: 288, height: 150 }
          : { width: 288, height: 176 };
  }
}

function FragmentPool({
  fragments,
  visibleFragmentIds,
  isOpen,
  onToggleOpen,
  onHideAll,
  onShowRecent,
  onToggleFragment
}: {
  fragments: DandelionFragmentRecord[];
  visibleFragmentIds: string[] | undefined;
  isOpen: boolean;
  onToggleOpen: () => void;
  onHideAll: () => void;
  onShowRecent: () => void;
  onToggleFragment: (fragmentId: string) => void;
}) {
  const visible = new Set(
    visibleFragmentIds ?? fragments.slice(0, 3).map((fragment) => fragment.id)
  );

  return (
    <div className="absolute right-5 top-5 z-30 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onToggleOpen}
        className="rounded-full border border-stone-900/10 bg-[#fff8e8]/80 px-4 py-2 text-xs font-semibold text-[#2c241b] shadow-lg shadow-stone-900/10 backdrop-blur"
      >
        碎片池 · {fragments.length}
      </button>
      {isOpen ? (
        <div className="w-72 rounded-[1.4rem] border border-stone-900/10 bg-[#fff8e8]/90 p-3 shadow-2xl shadow-stone-900/10 backdrop-blur">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={onHideAll}
              className="rounded-full bg-stone-900/10 px-3 py-1.5 text-xs text-stone-600"
            >
              隐藏全部
            </button>
            <button
              type="button"
              onClick={onShowRecent}
              className="rounded-full bg-[#667a4d] px-3 py-1.5 text-xs text-white"
            >
              显示最近 3 个
            </button>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {fragments.length === 0 ? (
              <p className="px-2 py-3 text-xs text-stone-500">
                还没有碎片。圈选偏离主线的想法后，这里会出现可隐藏的碎片。
              </p>
            ) : (
              fragments.map((fragment) => {
                const copy = formatFragmentCopy(fragment);

                return (
                  <label
                    key={fragment.id}
                    className="flex cursor-pointer gap-2 rounded-2xl bg-white/45 px-3 py-2 text-xs text-stone-700"
                  >
                    <input
                      type="checkbox"
                      checked={visible.has(fragment.id)}
                      onChange={() => onToggleFragment(fragment.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-semibold text-[#2c241b]">
                        {copy.title}
                      </span>
                      <span className="mt-1 line-clamp-2 block leading-5">
                        {copy.preview}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FragmentNode({
  data,
  selected
}: NodeProps<Node<InspirationFlowNodeData>>) {
  return (
    <div
      className={`dandelion-node group relative w-56 rounded-[1.35rem] border border-[#d9b75e]/35 bg-[#fff8e8]/88 p-4 shadow-xl shadow-stone-900/10 backdrop-blur transition ${
        selected ? "scale-105 ring-4 ring-[#f4c96b]/35" : "scale-100"
      }`}
      data-tags={data.tags.join(" ")}
      title={`产出自：${data.sourceTitle ?? "当前蒲公英"}`}
    >
      <NodeHandles canSource={false} />
      <p className="text-[10px] tracking-[0.24em] text-[#b38a2e]">
        碎片 · {data.vibe ?? "游离灵感"}
      </p>
      <h3 className="mt-2 text-sm font-semibold leading-snug text-[#2c241b]">
        {data.displayTitle}
      </h3>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-stone-600">
        {data.summary}
      </p>
      <div className="pointer-events-none absolute -top-9 left-3 hidden rounded-full bg-[#2c241b]/80 px-3 py-1.5 text-[10px] text-[#fff8e8] shadow-lg group-hover:block">
        产出自：{data.sourceTitle ?? "当前蒲公英"}
      </div>
      <TagTray data={data} />
    </div>
  );
}

function TopicNode({
  data,
  selected
}: NodeProps<Node<InspirationFlowNodeData>>) {
  const isDandelion = data.kind === "dandelion";
  const extensionToneClass = getExtensionToneClass(data.ageTone);
  const extensionSizeClass = getExtensionSizeClass(data.visualSize);

  return (
    <div
      className={`dandelion-node group relative rounded-[1.6rem] border shadow-2xl transition ${
        isDandelion
          ? "min-h-[13.5rem] w-[23rem] border-[#667a4d]/35 bg-[#fff8e8] p-6 shadow-stone-900/18"
          : `${extensionSizeClass} bg-[#fff8e8]/84 p-5 shadow-stone-900/8 ${extensionToneClass}`
      } ${
        selected
          ? "scale-105 opacity-100 ring-4 ring-[#f4c96b]/45"
        : "scale-100"
      }`}
      data-tags={data.tags.join(" ")}
    >
      <NodeHandles canSource={isDandelion || data.kind === "extension"} />
      <p className="text-[10px] tracking-[0.26em] text-[#667a4d]">
        {isDandelion ? "蒲公英中心" : "延伸"}
      </p>
      <h3
        className={`mt-2 font-semibold leading-snug text-[#2c241b] ${
          isDandelion ? "text-2xl" : "text-base"
        }`}
      >
        {data.displayTitle}
      </h3>
      <p
        className={`mt-3 leading-6 text-stone-700 ${
          isDandelion
            ? "line-clamp-6 text-sm"
            : selected
              ? "text-sm"
              : "text-xs leading-5"
        }`}
      >
        {data.summary}
      </p>
      <TagTray data={data} />
    </div>
  );
}

function TagTray({ data }: { data: InspirationFlowNodeData }) {
  if (data.tags.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute left-4 top-full z-20 hidden -translate-y-2 pt-2 group-hover:block">
      <div className="flex flex-wrap gap-1.5">
        {data.tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onMouseEnter={() => data.onTagHover?.(tag)}
            onMouseLeave={() => data.onTagHover?.(null)}
            onClick={() => data.onTagClick?.(tag)}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-medium shadow-sm shadow-stone-900/10 transition ${
              isTagLocked(tag, data.lockedTag ?? null)
                ? "border-[#f4c96b]/80 bg-[#f4c96b]/35 text-[#5d4b10] ring-2 ring-[#f4c96b]/35"
                : "border-[#667a4d]/15 bg-[#fff8e8]/95 text-[#667a4d]"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

function getExtensionSizeClass(
  visualSize: InspirationFlowNodeData["visualSize"]
) {
  switch (visualSize) {
    case "tall":
      return "w-72";
    case "wide":
      return "w-72";
    case "compact":
    default:
      return "w-60";
  }
}

function getExtensionToneClass(ageTone: InspirationFlowNodeData["ageTone"]) {
  switch (ageTone) {
    case "new":
      return "border-[#d9cfaa]/35";
    case "old":
      return "border-[#5f6f37]/60";
    case "middle":
    default:
      return "border-[#9aaa83]/45";
  }
}

function NodeHandles({ canSource }: { canSource: boolean }) {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-transparent"
      />
      {canSource ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2 !w-2 !border-0 !bg-transparent"
        />
      ) : null}
    </>
  );
}
