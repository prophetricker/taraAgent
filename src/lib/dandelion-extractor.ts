import { z } from "zod";

const dandelionDecisionSchema = z.object({
  should_capture: z.boolean(),
  confidence: z.number().min(0).max(1),
  content: z.string().default(""),
  original_context: z.string().default(""),
  sentiment_vibe: z.string().optional()
});

const MIN_AUTO_CAPTURE_SOURCE_LENGTH = 72;
const MIN_CONFIDENCE = 0.92;

export type DandelionDecision = {
  content: string;
  originalContext: string;
  sentimentVibe: string | null;
};

export function shouldAttemptDandelionExtraction(userMessage: string) {
  return normalizeForLength(userMessage).length >= MIN_AUTO_CAPTURE_SOURCE_LENGTH;
}

export function parseDandelionDecision(
  rawText: string,
  options: { sourceText?: string } = {}
): DandelionDecision | null {
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

  const parsed = dandelionDecisionSchema.safeParse(json);

  if (!parsed.success) {
    return null;
  }

  const decision = parsed.data;
  const content = decision.content.trim();
  const originalContext = decision.original_context.trim();
  const sentimentVibe = decision.sentiment_vibe?.trim() || null;

  if (
    !decision.should_capture ||
    decision.confidence < MIN_CONFIDENCE ||
    !content ||
    !originalContext
  ) {
    return null;
  }

  if (
    options.sourceText &&
    !isOriginalContextGroundedInSource(originalContext, options.sourceText)
  ) {
    return null;
  }

  return {
    content: content.slice(0, 30),
    originalContext: originalContext.slice(0, 1000),
    sentimentVibe: sentimentVibe?.slice(0, 80) ?? null
  };
}

export function buildDandelionExtractionPrompt(input: {
  currentTopic: string;
  userMessage: string;
}) {
  return `
判断用户最新输入中是否存在“值得保存但不应该打断当前主线”的旁支灵感。

当前主线：
${input.currentTopic || "未形成稳定主线"}

用户最新输入：
${input.userMessage}

严格规则：
- 只有当旁支想法自成一体、以后值得单独回看、且现在纳入主线会打断对话时，才 should_capture=true。
- 主线本身的补充、解释、举例、抱怨、偏好、普通细节，都不要保存。
- 不要因为“另外 / 其实 / 还有 / 顺便”等连接词本身就保存，必须判断语义是否真的是旁支。
- original_context 必须逐字摘自用户最新输入，不允许改写或补写。
- 只有非常确定时 confidence 才能高于 0.92。
- 如果不确定，必须 should_capture=false。
- 最多保存一个碎片。
- 只输出 JSON，不输出解释。

JSON 形状：
{
  "should_capture": false,
  "confidence": 0,
  "content": "",
  "original_context": "",
  "sentiment_vibe": ""
}
`.trim();
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

function isOriginalContextGroundedInSource(
  originalContext: string,
  sourceText: string
) {
  const context = normalizeForGrounding(originalContext);
  const source = normalizeForGrounding(sourceText);

  if (context.length < 8) {
    return false;
  }

  return source.includes(context);
}

function normalizeForLength(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function normalizeForGrounding(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[“”"‘'`]/g, "")
    .trim()
    .toLowerCase();
}
