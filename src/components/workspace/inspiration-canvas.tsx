"use client";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type NodeChange,
  type Node,
  type NodeProps,
  type ReactFlowInstance
} from "@xyflow/react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DandelionFragmentRecord } from "@/db/queries";
import { buildRightBrainGraph } from "@/lib/graph";
import type { InspirationFlowNodeData } from "@/lib/graph";

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
  const flowGraph = useMemo(
    () =>
      buildRightBrainGraph({
        graph,
        activeNodeId,
        fragments,
        maxPastTopics: 5
      }),
    [activeNodeId, fragments, graph]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(flowGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowGraph.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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

  useEffect(() => {
    setNodes((currentNodes) =>
      flowGraph.nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
        position:
          node.data.kind === "topic"
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
    <div className="h-full w-full">
      <div className="absolute left-6 top-5 z-10 rounded-3xl bg-[#fff8e8]/75 px-5 py-4 shadow-lg shadow-stone-900/10 backdrop-blur">
        <p className="text-xs tracking-[0.28em] text-[#667a4d]">
          RIGHT BRAIN CANVAS
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-[#2c241b]">
          右脑画布
        </h2>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        onInit={(instance) => {
          flowInstanceRef.current = instance;
        }}
        onNodeDragStop={(_, node) => {
          if (node.data.kind !== "topic") {
            return;
          }

          void onNodePositionChange(node.id, node.position);
        }}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#9aaa83" gap={28} size={1} />
        <MiniMap
          pannable
          zoomable
          className="!rounded-2xl !bg-[#fff8e8]/80"
          nodeColor="#667a4d"
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function FragmentNode({
  data,
  selected
}: NodeProps<Node<InspirationFlowNodeData>>) {
  return (
    <div
      className={`w-56 rounded-[1.35rem] border border-[#d9b75e]/35 bg-[#fff8e8]/82 p-4 shadow-xl shadow-stone-900/10 backdrop-blur transition ${
        selected ? "scale-105 ring-4 ring-[#f4c96b]/35" : "scale-100"
      }`}
    >
      <p className="text-[10px] tracking-[0.24em] text-[#b38a2e]">
        DANDELION · {data.vibe ?? "游离灵感"}
      </p>
      <h3 className="mt-2 text-sm font-semibold leading-snug text-[#2c241b]">
        {data.title}
      </h3>
      <p className="mt-2 line-clamp-4 text-xs leading-5 text-stone-600">
        {data.content}
      </p>
    </div>
  );
}

function TopicNode({
  data,
  selected
}: NodeProps<Node<InspirationFlowNodeData>>) {
  const isCurrent = data.isCurrent;

  return (
    <div
      className={`rounded-[1.6rem] border p-5 shadow-2xl transition ${
        isCurrent
          ? "w-80 border-[#667a4d]/35 bg-[#fff8e8] shadow-stone-900/18"
          : "w-60 border-stone-900/10 bg-[#fff8e8]/70 opacity-60 shadow-stone-900/8"
      } ${
        selected
          ? "scale-105 opacity-100 ring-4 ring-[#f4c96b]/45"
          : "scale-100"
      }`}
    >
      <p className="text-[10px] tracking-[0.26em] text-[#667a4d]">
        {isCurrent ? "CURRENT THEME" : "PAST TRACE"}
      </p>
      <h3
        className={`mt-2 font-semibold leading-snug text-[#2c241b] ${
          isCurrent ? "text-xl" : "text-base"
        }`}
      >
        {data.title}
      </h3>
      <p
        className={`mt-3 leading-6 text-stone-700 ${
          isCurrent || selected ? "line-clamp-5 text-sm" : "line-clamp-3 text-xs"
        }`}
      >
        {data.content}
      </p>
    </div>
  );
}
