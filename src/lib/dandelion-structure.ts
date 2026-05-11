import { z } from "zod";

import type {
  DandelionSummaryMessage,
  DandelionSummary
} from "./dandelion-summarizer";
import type { IdeaRelationKind } from "./graph";

const relationKindSchema = z.enum([
  "derivation",
  "association",
  "support",
  "conflict",
  "analogy",
  "pending"
]);

const dandelionStructureSchema = z.object({
  center: z.object({
    title: z.string(),
    summary: z.string()
  }),
  extension: z
    .object({
      title: z.string(),
      summary: z.string(),
      relationKind: relationKindSchema,
      relatedToPreviousExtension: z.boolean().optional(),
      centerStrength: z.number().min(0).max(1).optional(),
      extensionStrength: z.number().min(0).max(1).optional()
    })
    .nullable()
});

export type DandelionExtensionDraft = {
  title: string;
  summary: string;
  relationKind: Exclude<IdeaRelationKind, "capture">;
  relatedToPreviousExtension?: boolean;
  centerStrength?: number;
  extensionStrength?: number;
};

export type DandelionStructure = {
  center: DandelionSummary;
  extension: DandelionExtensionDraft | null;
};

export function parseDandelionStructure(
  rawText: string,
  options: { latestUserMessage?: string } = {}
): DandelionStructure | null {
  const jsonText = extractJson(rawText);

  if (!jsonText) {
    return null;
  }

  let json: unknown;

  try {
    json = JSON.parse(jsonText);
  } catch {
    return null;
  }

  const parsed = dandelionStructureSchema.safeParse(json);

  if (!parsed.success) {
    return null;
  }

  const center = normalizeCenter(parsed.data.center);

  if (!center) {
    return null;
  }

  return {
    center,
    extension: normalizeExtension(parsed.data.extension, options)
  };
}

export function buildDandelionStructurePrompt(input: {
  previousTitle: string;
  previousSummary: string;
  messages: DandelionSummaryMessage[];
}) {
  const conversation = input.messages
    .slice(-16)
    .map((message) => `${roleLabel(message.role)}：${message.content}`)
    .join("\n");

  return `
请通读当前对话，整理当前蒲公英图的“中心”和“一个可新增的延伸”。

蒲公英中心：
- 中心可以随着对话不断完善，不是一次性定稿。
- 它是这颗蒲公英的起点和树根，重点说明这个想法由什么问题、动机或张力发起。
- 不要把所有补充都塞进中心；中心解释“为什么从这里开始”，延伸承载“后来长出了什么”。
- 标题要包含足够上下文，不能只写“重要问题”“当前主题”。

延伸：
- 延伸是当前蒲公英内部节点，不是远离主题的碎片。
- 只在最近对话确实长出一个可独立阅读的新分支时生成；否则返回 null。
- 延伸标题必须是概括，不得直接摘抄用户原句，不得写“b和c都重要”这类低信息句。
- 延伸 summary 用一句话说明它补充了什么，以及为什么属于当前蒲公英。
- 延伸 summary 必须像卡片正文一样直接可读，禁止写“补充了……策略”“说明了……想法”“此刻必要的……”这类元叙述。
- 延伸后续可能被语义合并，所以要写得清楚、可与相似延伸比较。
- 如果这个延伸明显承接上一条延伸，请把 relatedToPreviousExtension 设为 true。
- centerStrength 用 0 到 1 表示它和中心的强关系，extensionStrength 用 0 到 1 表示它和上一条/同组延伸的强关系；不确定时省略。

当前旧标题：
${input.previousTitle || "未命名蒲公英"}

当前旧说明：
${input.previousSummary || "暂无稳定说明"}

当前对话：
${conversation || "暂无对话"}

输出严格 JSON，不要 Markdown，不要解释：
{
  "center": {
    "title": "不超过 28 个字，命名这颗蒲公英的起点",
    "summary": "70 到 160 字，解释发起原因、核心张力和可向外延伸的方向"
  },
  "extension": {
    "title": "不超过 18 个字，命名一个新增延伸；没有新增延伸时填 null",
    "summary": "30 到 90 字，一句话概括这个延伸补充了什么",
    "relationKind": "derivation | association | support | conflict | analogy | pending",
    "relatedToPreviousExtension": true,
    "centerStrength": 0.82,
    "extensionStrength": 0.71
  }
}
`.trim();
}

function normalizeCenter(input: { title: string; summary: string }) {
  const title = normalizeWhitespace(input.title).slice(0, 28);
  const summary = normalizeWhitespace(input.summary).slice(0, 220);

  if (title.length < 4 || summary.length < 30) {
    return null;
  }

  return { title, summary };
}

function normalizeExtension(
  input: z.infer<typeof dandelionStructureSchema>["extension"],
  options: { latestUserMessage?: string }
) {
  if (!input) {
    return null;
  }

  const title = normalizeWhitespace(input.title).slice(0, 18);
  const summary = normalizeExtensionSummary({
    title,
    summary: normalizeWhitespace(input.summary)
  }).slice(0, 120);

  if (title.length < 4 || summary.length < 24) {
    return null;
  }

  if (isLowSignalTitle(title)) {
    return null;
  }

  if (
    options.latestUserMessage &&
    normalizeForCopyCheck(summary) ===
      normalizeForCopyCheck(options.latestUserMessage)
  ) {
    return null;
  }

  return {
    title,
    summary,
    relationKind: input.relationKind,
    relatedToPreviousExtension: input.relatedToPreviousExtension,
    centerStrength: input.centerStrength,
    extensionStrength: input.extensionStrength
  };
}

function roleLabel(role: DandelionSummaryMessage["role"]) {
  switch (role) {
    case "user":
      return "用户";
    case "assistant":
      return "Agent";
    case "tool":
      return "工具";
    case "system":
    default:
      return "系统";
  }
}

function extractJson(rawText: string) {
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? rawText).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return candidate.slice(start, end + 1);
}

function isLowSignalTitle(title: string) {
  return /(都重要|比较重要|很重要|重要问题|当前主题|这个问题|那个问题|b和c|a和b|b 和 c)/iu.test(
    title
  );
}

function normalizeExtensionSummary(input: { title: string; summary: string }) {
  const summary = input.summary;

  if (
    /^(补充了|说明了|指出了|提出了|强调了|表达了|记录了)/u.test(summary) ||
    /教学策略|此刻必要|只让此刻/u.test(summary)
  ) {
    if (input.title.includes("最小MVP") || input.title.includes("主线")) {
      return `把当前主线收束到“${input.title}”这条分支，先保证最小闭环跑通。`;
    }

    return `把当前分支收束为“${input.title}”，说明它如何支撑这颗蒲公英继续展开。`;
  }

  return ensureSentence(summary);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function ensureSentence(value: string) {
  if (!value) {
    return "";
  }

  return /[。！？!?]$/u.test(value) ? value : `${value}。`;
}

function normalizeForCopyCheck(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").trim();
}
