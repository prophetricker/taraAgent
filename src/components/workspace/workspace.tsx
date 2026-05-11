"use client";

import type { Edge, Node } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useCallback, useEffect, useRef, useState } from "react";

import { AmbientMusicToggle } from "@/components/workspace/ambient-music-toggle";
import { ChatPane } from "@/components/workspace/chat-pane";
import { InspirationCanvas } from "@/components/workspace/inspiration-canvas";
import type { DandelionFragmentRecord, MessageRecord } from "@/db/queries";
import type { DatabaseHealth } from "@/lib/database-health";
import { formatFragmentCopy } from "@/lib/fragments";
import type {
  IdeaRelationKind,
  IdeaRelationRecord,
  InspirationFlowNodeData
} from "@/lib/graph";
import type { GuardianMode } from "@/lib/prompt";
import {
  applyRelationOptimisticUpdate,
  applyRelationSaveFailure,
  getInitialCanvasNotice
} from "@/lib/workspace-state";
import {
  getNewDandelionDraft,
  getWorkspaceNodeHref
} from "@/lib/workspace-navigation";
import type { SaveStatus } from "@/lib/save-status";

type Props = {
  activeNodeId: string;
  conversationId: string;
  initialGraph: {
    nodes: Node<InspirationFlowNodeData>[];
    edges: Edge[];
  };
  initialRelations: IdeaRelationRecord[];
  initialDatabaseHealth: DatabaseHealth;
  initialFragments: DandelionFragmentRecord[];
  initialMessages: MessageRecord[];
  userEmail: string;
};

export function Workspace({
  activeNodeId,
  conversationId,
  initialGraph,
  initialRelations,
  initialDatabaseHealth,
  initialFragments,
  initialMessages,
  userEmail
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<GuardianMode>("listener");
  const [fragments, setFragments] =
    useState<DandelionFragmentRecord[]>(initialFragments);
  const [graph, setGraph] = useState(initialGraph);
  const [relations, setRelations] =
    useState<IdeaRelationRecord[]>(initialRelations);
  const [databaseHealth, setDatabaseHealth] =
    useState<DatabaseHealth>(initialDatabaseHealth);
  const [canvasNotice, setCanvasNotice] = useState<string | null>(
    getInitialCanvasNotice(initialDatabaseHealth)
  );
  const [fragmentNotice, setFragmentNotice] =
    useState<DandelionFragmentRecord | null>(null);
  const [isCreatingDandelion, setIsCreatingDandelion] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const previousLatestFragmentId = useRef(initialFragments[0]?.id ?? null);
  const saveStatusTimerRef = useRef<number | null>(null);

  const showSaveStatus = useCallback((status: SaveStatus) => {
    if (saveStatusTimerRef.current) {
      window.clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = null;
    }

    setSaveStatus(status);

    if (status.state === "saved" || status.state === "failed") {
      saveStatusTimerRef.current = window.setTimeout(
        () => setSaveStatus(null),
        status.state === "failed" ? 5200 : 1800
      );
    }
  }, []);

  const refreshGraph = useCallback(async () => {
    const response = await fetch("/api/nodes", {
      cache: "no-store"
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as typeof initialGraph & {
      relations?: IdeaRelationRecord[];
      databaseHealth?: DatabaseHealth;
    };
    setGraph({
      nodes: payload.nodes,
      edges: payload.edges
    });
    setRelations(payload.relations ?? []);
    if (payload.databaseHealth) {
      setDatabaseHealth(payload.databaseHealth);
      setCanvasNotice(
        getInitialCanvasNotice(payload.databaseHealth)
      );
    }
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

  useEffect(
    () => () => {
      if (saveStatusTimerRef.current) {
        window.clearTimeout(saveStatusTimerRef.current);
      }
    },
    []
  );

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
      showSaveStatus({ state: "saving", target: "节点位置" });

      const response = await fetch("/api/nodes/position", {
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

      if (!response.ok) {
        showSaveStatus({
          state: "failed",
          target: "节点位置",
          detail: "刷新后可能回到旧位置"
        });
        setCanvasNotice("节点位置保存失败，刷新后可能回到旧位置。");
        return;
      }

      showSaveStatus({ state: "saved", target: "节点位置" });
    },
    [showSaveStatus]
  );

  const saveIdeaRelation = useCallback(
    async (input: {
      sourceNodeId: string;
      targetNodeId: string;
      relationKind: IdeaRelationKind;
    }) => {
      const previousRelations = relations;

      setRelations((current) => applyRelationOptimisticUpdate(current, input));
      showSaveStatus({ state: "saving", target: "关系" });

      const response = await fetch("/api/relations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          databaseHealth?: DatabaseHealth;
        } | null;

        setRelations(applyRelationSaveFailure(previousRelations));
        if (payload?.databaseHealth) {
          setDatabaseHealth(payload.databaseHealth);
        }
        showSaveStatus({
          state: "failed",
          target: "关系",
          detail: "刚才的线条修改已经回滚"
        });
        setCanvasNotice(
          payload?.error ??
            "关系保存失败：刚才的线条修改已经回滚，请稍后重试。"
        );
        return false;
      }

      showSaveStatus({ state: "saved", target: "关系" });
      setCanvasNotice(null);
      return true;
    },
    [relations, showSaveStatus]
  );

  const createNewDandelion = useCallback(async () => {
    if (isCreatingDandelion) {
      return;
    }

    setIsCreatingDandelion(true);
    const draft = getNewDandelionDraft();
    const createdAtLabel = new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());

    try {
      const response = await fetch("/api/nodes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          parentId: null,
          title: `${draft.title} ${createdAtLabel}`,
          content: draft.content,
          positionX: 80,
          positionY: 120
        })
      });

      if (!response.ok) {
        setCanvasNotice("新建蒲公英失败：请检查登录状态或数据库连接。");
        return;
      }

      const node = (await response.json()) as { id: string };
      router.push(getWorkspaceNodeHref(node.id) as Route);
    } finally {
      setIsCreatingDandelion(false);
    }
  }, [isCreatingDandelion, router]);

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
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <button
              type="button"
              onClick={createNewDandelion}
              disabled={isCreatingDandelion}
              className="rounded-full border border-[#667a4d]/20 bg-[#667a4d] px-4 py-2 text-xs font-semibold text-[#fff8e8] shadow-sm shadow-stone-900/10 transition hover:bg-[#56683f] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isCreatingDandelion ? "正在新建..." : "新建蒲公英 / 新对话"}
            </button>
            <AmbientMusicToggle />
          </div>
        </header>
        <ChatPane
          activeNodeId={activeNodeId}
          conversationId={conversationId}
          mode={mode}
          initialMessages={initialMessages}
          onFragmentCreated={addFragment}
          onSaveStatusChange={showSaveStatus}
          onStreamFinished={async () => {
            await Promise.all([refreshFragments(), refreshGraph()]);
          }}
        />
      </section>

      <section className="relative mt-3 min-h-0 overflow-hidden rounded-[2rem] border border-stone-900/10 bg-[#e9e2ce]/75 shadow-2xl shadow-stone-900/10 backdrop-blur lg:mt-0">
        <InspirationCanvas
          activeNodeId={activeNodeId}
          graph={graph}
          relations={relations}
          fragments={fragments}
          databaseHealth={databaseHealth}
          notice={canvasNotice}
          saveStatus={saveStatus}
          onNoticeDismiss={() => setCanvasNotice(null)}
          onNodePositionChange={saveNodePosition}
          onRelationChange={saveIdeaRelation}
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
