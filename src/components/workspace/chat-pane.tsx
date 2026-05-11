"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import type { DandelionFragmentRecord, MessageRecord } from "@/db/queries";
import { getTextFromParts } from "@/lib/messages";
import { getChatOnboardingPrompts } from "@/lib/onboarding";
import type { GuardianMode } from "@/lib/prompt";
import type { SaveStatus } from "@/lib/save-status";

type Props = {
  activeNodeId: string;
  conversationId: string;
  mode: GuardianMode;
  initialMessages: MessageRecord[];
  onFragmentCreated: (fragment: DandelionFragmentRecord) => void;
  onSaveStatusChange: (status: SaveStatus) => void;
  onStreamFinished: () => Promise<void>;
};

export function ChatPane({
  activeNodeId,
  conversationId,
  mode,
  initialMessages,
  onFragmentCreated,
  onSaveStatusChange,
  onStreamFinished
}: Props) {
  const [input, setInput] = useState("");
  const [selection, setSelection] = useState("");
  const [selectionNote, setSelectionNote] = useState("");
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            nodeId: activeNodeId,
            conversationId,
            mode
          }
        })
      }),
    [activeNodeId, conversationId, mode]
  );

  const { messages, sendMessage, status, error } = useChat({
    id: conversationId,
    messages: initialMessages
      .filter(isVisibleChatMessage)
      .map((message) => ({
        id: message.id,
        role: message.role,
        parts: [{ type: "text" as const, text: message.content }]
      })),
    transport,
    onFinish: async () => {
      await onStreamFinished();
    }
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();

    if (!text || status !== "ready") {
      return;
    }

    setInput("");
    await sendMessage({ text });
  }

  function handleSelection() {
    const selectedText = window.getSelection()?.toString().trim();

    if (selectedText && selectedText.length > 1) {
      setSelection(selectedText);
      setSelectionNote("");
      setCaptureError(null);
    }
  }

  async function captureSelection() {
    if (isCapturing) {
      return;
    }

    const content = selectionNote.trim() || selection.slice(0, 30);
    setIsCapturing(true);
    onSaveStatusChange({ state: "saving", target: "碎片" });

    try {
      const response = await fetch("/api/fragments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nodeId: activeNodeId,
          conversationId,
          content: content.slice(0, 80),
          originalContext: selection,
          sentimentVibe: "手动圈选"
        })
      });

      if (!response.ok) {
        onSaveStatusChange({
          state: "failed",
          target: "碎片",
          detail: "请检查登录状态或数据库连接"
        });
        setCaptureError("保存失败，请检查登录状态或数据库连接。");
        return;
      }

      const payload = (await response.json()) as {
        fragment: DandelionFragmentRecord;
      };
      onFragmentCreated(payload.fragment);
      setSelection("");
      setSelectionNote("");
      setCaptureError(null);
      onSaveStatusChange({ state: "saved", target: "碎片" });
    } catch {
      onSaveStatusChange({
        state: "failed",
        target: "碎片",
        detail: "网络异常，请稍后重试"
      });
      setCaptureError("保存失败，请稍后重试。");
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <>
      <div
        onMouseUp={handleSelection}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5"
      >
        {messages.length === 0 ? (
          <EmptyState onPromptPick={setInput} />
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        {status === "streaming" || status === "submitted" ? (
          <div className="ml-1 text-sm italic text-stone-500">
            温室正在回应...
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {error.message}
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {selection ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="mx-5 mb-3 rounded-3xl border border-[#667a4d]/25 bg-[#f7f1dc] p-4 shadow-xl shadow-stone-900/10"
          >
            <p className="mb-2 line-clamp-2 text-sm text-stone-700">
              {selection}
            </p>
            <div className="flex gap-2">
              <input
                value={selectionNote}
                onChange={(event) => setSelectionNote(event.target.value)}
                placeholder="给这枚碎片一个短标题..."
                className="min-w-0 flex-1 rounded-2xl border border-stone-900/10 bg-white/75 px-3 py-2 text-sm outline-none focus:border-[#667a4d]"
              />
              <button
                type="button"
                onClick={captureSelection}
                disabled={isCapturing}
                className="rounded-2xl bg-[#667a4d] px-4 py-2 text-sm font-semibold text-white"
              >
                {isCapturing ? "捕捉中" : "捕捉"}
              </button>
              <button
                type="button"
                onClick={() => setSelection("")}
                className="rounded-2xl px-3 py-2 text-sm text-stone-500"
              >
                取消
              </button>
            </div>
            {captureError ? (
              <p className="mt-2 text-xs text-red-700">{captureError}</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <form
        onSubmit={handleSubmit}
        className="border-t border-stone-900/10 p-5"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          placeholder={
            mode === "listener"
              ? "倾倒一段还没有成形的想法..."
              : "告诉我你想扎根哪一部分..."
          }
          className="w-full resize-none rounded-[1.5rem] border border-stone-900/10 bg-white/70 px-4 py-3 leading-7 outline-none transition focus:border-[#667a4d] focus:ring-4 focus:ring-[#667a4d]/15"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            {mode === "listener"
              ? "倾听模式：少总结，低打扰。"
              : "追问模式：一次只推进一个关键问题。"}
          </span>
          <button
            type="submit"
            disabled={!input.trim() || status !== "ready"}
            className="rounded-2xl bg-[#2c241b] px-5 py-2.5 text-sm font-semibold text-[#fff8e8] transition hover:bg-[#433728] disabled:cursor-not-allowed disabled:opacity-45"
          >
            发送
          </button>
        </div>
      </form>
    </>
  );
}

function isVisibleChatMessage(
  message: MessageRecord
): message is MessageRecord & { role: "user" | "assistant" } {
  return message.role === "user" || message.role === "assistant";
}

function EmptyState({ onPromptPick }: { onPromptPick: (prompt: string) => void }) {
  const prompts = getChatOnboardingPrompts();

  return (
    <div className="rounded-[1.75rem] border border-dashed border-[#667a4d]/35 bg-white/45 p-6">
      <p className="text-sm tracking-[0.25em] text-[#667a4d]">SEED NOTE</p>
      <h2 className="mt-2 text-2xl font-semibold text-[#2c241b]">
        先不用整理。
      </h2>
      <p className="mt-3 leading-7 text-stone-700">
        把脑子里松散、矛盾、还不能定义的东西倒出来。右侧会沉淀当前蒲公英、延伸和游离碎片。
      </p>
      <div className="mt-5 grid gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPromptPick(prompt)}
            className="rounded-2xl border border-[#667a4d]/15 bg-[#fff8e8]/70 px-4 py-3 text-left text-sm leading-6 text-[#4f5f2d] transition hover:border-[#667a4d]/35 hover:bg-[#fff8e8]"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = getTextFromParts(message);

  return (
    <article
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[88%] rounded-[1.5rem] px-4 py-3 leading-7 shadow-sm ${
          isUser
            ? "bg-[#2c241b] text-[#fff8e8]"
            : "bg-white/75 text-stone-800"
        }`}
      >
        {text ? (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => (
                <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>
              )
            }}
          >
            {text}
          </ReactMarkdown>
        ) : (
          <span className="text-sm italic opacity-70">正在生成...</span>
        )}
      </div>
    </article>
  );
}
