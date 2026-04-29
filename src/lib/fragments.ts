export type FragmentFingerprintInput = {
  content: string;
  originalContext: string;
};

export type FragmentCopyInput = {
  content: string;
  originalContext: string;
  sentimentVibe?: string | null;
};

const GENERIC_FRAGMENT_TITLES = new Set([
  "旁支",
  "旁支想法",
  "碎片",
  "灵感碎片",
  "新想法",
  "新的想法",
  "游离灵感"
]);

export function findDuplicateFragment<T extends FragmentFingerprintInput>(
  fragments: T[],
  input: FragmentFingerprintInput
): T | null {
  const content = normalizeFragmentFingerprint(input.content);
  const originalContext = normalizeFragmentFingerprint(input.originalContext);

  return (
    fragments.find((fragment) => {
      const existingContent = normalizeFragmentFingerprint(fragment.content);
      const existingContext = normalizeFragmentFingerprint(
        fragment.originalContext
      );

      return (
        (!!content && content === existingContent) ||
        (!!originalContext && originalContext === existingContext)
      );
    }) ?? null
  );
}

export function formatFragmentCopy(input: FragmentCopyInput) {
  const preview = buildPreview(input.originalContext);
  const cleanedContent = cleanFragmentTitle(input.content);
  const fallbackTitle = buildTitleFromContext(preview);
  const title =
    cleanedContent && !GENERIC_FRAGMENT_TITLES.has(cleanedContent)
      ? cleanedContent
      : fallbackTitle;

  return {
    title: title.slice(0, 22) || "未命名碎片",
    preview,
    vibe: input.sentimentVibe?.trim() || "游离灵感"
  };
}

function normalizeFragmentFingerprint(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function buildPreview(value: string) {
  return cleanFragmentPreview(value).slice(0, 96);
}

function buildTitleFromContext(value: string) {
  const [firstClause] = value
    .split(/[。！？!?；;，,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return cleanFragmentTitle(firstClause ?? value).slice(0, 22);
}

function cleanFragmentTitle(value: string) {
  const [firstClause] = cleanFragmentPreview(value)
    .split(/[。！？!?；;，,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return stripFirstPersonLead(firstClause ?? value).slice(0, 22);
}

function cleanFragmentPreview(value: string) {
  return value
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .replace(/^(另外|顺便|还有|其实|然后|同时|对了)[，,、\s]*/u, "")
    .trim();
}

function stripFirstPersonLead(value: string) {
  return value
    .replace(/^(我还想到|我想到|我还想|我想起|我脑子里还闪过)[一一个些\s]*/u, "")
    .replace(/^(以后可以把|可以把|把)/u, "")
    .trim();
}
