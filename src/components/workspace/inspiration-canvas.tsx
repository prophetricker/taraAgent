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
import { getFloatingEdgeGeometry } from "@/lib/floating-edge";
import { formatFragmentCopy } from "@/lib/fragments";
import { buildRightBrainGraph } from "@/lib/graph";
import type { InspirationFlowNodeData } from "@/lib/graph";

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
  fragments,
  onNodePositionChange
}: {
  activeNodeId: string;
  graph: {
    nodes: Node<InspirationFlowNodeData>[];
    edges: Edge[];
  };
  fragments: DandelionFragmentRecord[];
  onNodePositionChange: (
    nodeId: string,
    position: { x: number; y: number }
  ) => Promise<void>;
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
        visibleFragmentIds
      }),
    [activeNodeId, fragments, graph, visibleFragmentIds]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(flowGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowGraph.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedTag, setHighlightedTag] = useState<string | null>(null);
  const flowInstanceRef = useRef<ReactFlowInstance<
    Node<InspirationFlowNodeData>,
    Edge
  > | null>(null);
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
          onTagHover: setHighlightedTag
        },
        position:
          node.data.kind === "dandelion"
            ? currentNodes.find((currentNode) => currentNode.id === node.id)
                ?.position ?? node.position
            : node.position
      }))
    );
    setEdges(flowGraph.edges);
  }, [flowGraph, selectedNodeId, setEdges, setNodes]);

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

  return (
    <div
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
        onPaneClick={() => setSelectedNodeId(null)}
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
  onPaneClick,
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
  onPaneClick: () => void;
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
      onPaneClick={onPaneClick}
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
          <span
            key={tag}
            onMouseEnter={() => data.onTagHover?.(tag)}
            onMouseLeave={() => data.onTagHover?.(null)}
            className="rounded-full border border-[#667a4d]/15 bg-[#fff8e8]/95 px-2.5 py-1 text-[10px] font-medium text-[#667a4d] shadow-sm shadow-stone-900/10"
          >
            {tag}
          </span>
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
