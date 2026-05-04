"use client";

import type { Edge, Node } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatPane } from "@/components/workspace/chat-pane";
import { InspirationCanvas } from "@/components/workspace/inspiration-canvas";
import type { DandelionFragmentRecord, MessageRecord } from "@/db/queries";
import { formatFragmentCopy } from "@/lib/fragments";
import type { InspirationFlowNodeData } from "@/lib/graph";
import type { GuardianMode } from "@/lib/prompt";

type Props = {
  activeNodeId: string;
  conversationId: string;
  initialGraph: {
    nodes: Node<InspirationFlowNodeData>[];
    edges: Edge[];
  };
  initialFragments: DandelionFragmentRecord[];
  initialMessages: MessageRecord[];
  userEmail: string;
};

export function Workspace({
  activeNodeId,
  conversationId,
  initialGraph,
  initialFragments,
  initialMessages,
  userEmail
}: Props) {
  const [mode, setMode] = useState<GuardianMode>("listener");
  const [fragments, setFragments] =
    useState<DandelionFragmentRecord[]>(initialFragments);
  const [graph, setGraph] = useState(initialGraph);
  const [fragmentNotice, setFragmentNotice] =
    useState<DandelionFragmentRecord | null>(null);
  const previousLatestFragmentId = useRef(initialFragments[0]?.id ?? null);

  const refreshGraph = useCallback(async () => {
    const response = await fetch("/api/nodes", {
      cache: "no-store"
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as typeof initialGraph;
    setGraph(payload);
  }, []);

  const refreshFragments = useCallback(async () => {
    const response = await fetch(`/api/fragments?node_id=${activeNodeId}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      fragments: DandelionFragmentRecord[];
    };
    setFragments(payload.fragments);
  }, [activeNodeId]);

  const addFragment = useCallback((fragment: DandelionFragmentRecord) => {
    setFragments((current) => {
      if (current.some((item) => item.id === fragment.id)) {
        return current;
      }

      return [fragment, ...current];
    });
  }, []);

  useEffect(() => {
    const latestFragment = fragments[0];

    if (!latestFragment || latestFragment.id === previousLatestFragmentId.current) {
      return;
    }

    previousLatestFragmentId.current = latestFragment.id;
    setFragmentNotice(latestFragment);
    const timer = window.setTimeout(() => setFragmentNotice(null), 3200);

    return () => window.clearTimeout(timer);
  }, [fragments]);

  const saveNodePosition = useCallback(
    async (nodeId: string, position: { x: number; y: number }) => {
      setGraph((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                position
              }
            : node
        )
      }));

      await fetch("/api/nodes/position", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nodeId,
          positionX: position.x,
          positionY: position.y
        })
      });
    },
    []
  );

  return (
    <main className="grid h-screen grid-cols-1 overflow-hidden p-3 lg:grid-cols-[minmax(420px,0.9fr)_minmax(560px,1.1fr)] lg:gap-3">
      <section className="flex min-h-0 flex-col rounded-[2rem] border border-stone-900/10 bg-[#fff8e8]/85 shadow-2xl shadow-stone-900/10 backdrop-blur">
        <header className="border-b border-stone-900/10 px-6 py-5">
          <p className="text-xs tracking-[0.28em] text-[#667a4d]">
            LEFT BRAIN DIALOGUE
          </p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-[#2c241b]">
                灵感温室
              </h1>
              <p className="mt-1 text-xs text-stone-500">{userEmail}</p>
            </div>
            <ModeSwitch mode={mode} onChange={setMode} />
          </div>
        </header>
        <ChatPane
          activeNodeId={activeNodeId}
          conversationId={conversationId}
          mode={mode}
          initialMessages={initialMessages}
          onFragmentCreated={addFragment}
          onStreamFinished={async () => {
            await Promise.all([refreshFragments(), refreshGraph()]);
          }}
        />
      </section>

      <section className="relative mt-3 min-h-0 overflow-hidden rounded-[2rem] border border-stone-900/10 bg-[#e9e2ce]/75 shadow-2xl shadow-stone-900/10 backdrop-blur lg:mt-0">
        <InspirationCanvas
          activeNodeId={activeNodeId}
          graph={graph}
          fragments={fragments}
          onNodePositionChange={saveNodePosition}
        />
        <FragmentNotice fragment={fragmentNotice} />
      </section>
    </main>
  );
}

function FragmentNotice({
  fragment
}: {
  fragment: DandelionFragmentRecord | null;
}) {
  const copy = fragment ? formatFragmentCopy(fragment) : null;

  return (
    <AnimatePresence>
      {fragment && copy ? (
        <motion.div
          key={fragment.id}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="pointer-events-none absolute left-1/2 top-5 z-30 -translate-x-1/2 rounded-full border border-[#667a4d]/20 bg-[#fff8e8]/70 px-4 py-2 text-xs text-[#667a4d] shadow-lg shadow-stone-900/10 backdrop-blur"
        >
          捕捉到一枚新的碎片：{copy.title}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ModeSwitch({
  mode,
  onChange
}: {
  mode: GuardianMode;
  onChange: (mode: GuardianMode) => void;
}) {
  const isSocrates = mode === "socrates";

  return (
    <button
      type="button"
      onClick={() => onChange(isSocrates ? "listener" : "socrates")}
      className="rounded-full border border-stone-900/10 bg-white/60 p-1 text-xs shadow-inner shadow-stone-900/5"
      aria-label="切换 Agent 模式"
    >
      <span
        className={`inline-flex rounded-full px-4 py-2 transition ${
          !isSocrates
            ? "bg-[#667a4d] text-[#fff8e8]"
            : "bg-transparent text-stone-500"
        }`}
      >
        倾听
      </span>
      <span
        className={`inline-flex rounded-full px-4 py-2 transition ${
          isSocrates
            ? "bg-[#2c241b] text-[#fff8e8]"
            : "bg-transparent text-stone-500"
        }`}
      >
        追问
      </span>
    </button>
  );
}
