const DEFAULT_TOPIC = {
  title: "入口灵感",
  summary: "从这里开始倾倒、保护和深挖一个想法。"
};

const DEFAULT_SUMMARY = DEFAULT_TOPIC.summary;

export function deriveTopicFromMessage(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return DEFAULT_TOPIC;
  }

  return {
    title: deriveTopicTitle(normalized),
    summary: normalized.slice(0, 180)
  };
}

export function deriveTopicFromConversation({
  previousSummary,
  latestMessage
}: {
  previousSummary: string;
  latestMessage: string;
}) {
  const latest = latestMessage.replace(/\s+/g, " ").trim();

  if (!latest) {
    return DEFAULT_TOPIC;
  }

  const previous =
    previousSummary.trim() === DEFAULT_SUMMARY ? "" : previousSummary.trim();
  const summary = previous ? mergeSummary(previous, latest) : latest.slice(0, 180);

  return {
    title: deriveTopicTitle(summary),
    summary
  };
}

export function deriveBranchTopic(messages: string[]) {
  const text = messages
    .map((message) => message.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" / ");

  return deriveTopicFromMessage(text);
}

function deriveTopicTitle(text: string) {
  const [firstClause] = text
    .split(/[。！？!?；;，,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const candidate = (firstClause || text)
    .replace(/^(我|我们|现在|其实|就是|这个|那个|想要|想做|希望|需要|应该|感觉)+/, "")
    .replace(/^(做一个|做个|聊一个|讨论一个)/, "")
    .trim();

  return (candidate || "当前主题").slice(0, 24);
}

function mergeSummary(previous: string, latest: string) {
  const latestShort = latest.slice(0, 120);

  if (previous.includes(latestShort) || latestShort.includes(previous)) {
    return previous.slice(0, 240);
  }

  return `${previous.slice(0, 140)} / ${latestShort}`.slice(0, 240);
}
