import { z } from "zod";

const dandelionSummarySchema = z.object({
  title: z.string(),
  summary: z.string()
});

export type DandelionSummaryMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
};

export type DandelionSummary = {
  title: string;
  summary: string;
};

export function parseDandelionSummary(
  rawText: string,
  options: { latestUserMessage?: string } = {}
): DandelionSummary | null {
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

  const parsed = dandelionSummarySchema.safeParse(json);

  if (!parsed.success) {
    return null;
  }

  const title = normalizeWhitespace(parsed.data.title).slice(0, 28);
  const summary = normalizeWhitespace(parsed.data.summary).slice(0, 220);

  if (title.length < 4 || summary.length < 36) {
    return null;
  }

  if (
    options.latestUserMessage &&
    normalizeForCopyCheck(summary) ===
      normalizeForCopyCheck(options.latestUserMessage)
  ) {
    return null;
  }

  return { title, summary };
}

export function buildDandelionSummaryPrompt(input: {
  previousTitle: string;
  previousSummary: string;
  messages: DandelionSummaryMessage[];
}) {
  const conversation = input.messages
    .slice(-16)
    .map((message) => `${roleLabel(message.role)}：${message.content}`)
    .join("\n");

  return `
请通读当前对话，更新“蒲公英中心”的标题和说明。

蒲公英中心的任务：
- 它是这颗蒲公英的起点和树根，不是整棵树的目录。
- 重点说明这个思考是由什么问题、动机或张力发起的。
- 不要把所有延伸都塞进中心；后续补充应留给延伸块。
- 标题要命名这个起点，summary 要解释“为什么从这里开始”。
- summary 可以比普通延伸更长，但必须克制、清晰、可读。

当前旧标题：
${input.previousTitle || "未命名蒲公英"}

当前旧说明：
${input.previousSummary || "暂无稳定说明"}

当前对话：
${conversation || "暂无对话"}

输出严格 JSON，不要 Markdown，不要解释：
{
  "title": "不超过 28 个字的概括标题",
  "summary": "70 到 140 字，说明这颗蒲公英的起点、发起原因、核心张力和可以向外延伸的方向"
}
`.trim();
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

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForCopyCheck(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").trim();
}
