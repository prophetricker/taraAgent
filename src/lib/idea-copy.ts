const TAG_RULES = [
  {
    tag: "文案",
    patterns: ["标题", "简介", "归纳", "上下文", "语句", "单独看"]
  },
  {
    tag: "自动捕捉",
    patterns: ["自动", "触发", "兜底", "泛滥", "生成"]
  },
  { tag: "画布", patterns: ["画布", "画板", "右侧", "排版", "布局"] },
  {
    tag: "布局",
    patterns: ["排版", "布局", "摆放", "靠近", "远近", "离中心", "离得", "距离", "重叠", "挤"]
  },
  { tag: "关系线", patterns: ["关系线", "连线", "推导", "联想", "关系"] },
  { tag: "碎片", patterns: ["碎片", "触角", "远离", "游离"] },
  { tag: "延伸", patterns: ["延伸", "冠毛", "生长", "支撑"] },
  { tag: "相关度", patterns: ["相关度", "相关", "相似", "靠近", "远"] },
  { tag: "聚类", patterns: ["聚类", "合并", "分类", "一类"] },
  { tag: "视角", patterns: ["视角", "一阵风", "重新整理", "换个"] },
  { tag: "交互", patterns: ["拖动", "悬停", "点击", "隐藏", "显示"] }
];

export type IdeaNodeCopyInput = {
  title: string;
  content: string;
  role?: "dandelion" | "extension";
};

export function formatIdeaNodeCopy(input: IdeaNodeCopyInput) {
  const combined = normalizeText(`${input.title} ${input.content}`);
  const source = normalizeText(input.content || input.title);
  const tags = extractIdeaTags(combined);
  const title = createDisplayTitle({
    title: input.title,
    source,
    combined,
    tags,
    role: input.role ?? "extension"
  });

  return {
    displayTitle: title || "未命名想法",
    summary: summarizeIdea({
      text: source,
      combined,
      tags,
      title,
      role: input.role ?? "extension"
    }),
    tags
  };
}

export function extractIdeaTags(text: string) {
  const normalized = normalizeText(text);
  const tags = TAG_RULES.filter((rule) =>
    rule.patterns.some((pattern) => normalized.includes(pattern))
  ).map((rule) => rule.tag);

  return tags.slice(0, 4);
}

function createDisplayTitle(input: {
  title: string;
  source: string;
  combined: string;
  tags: string[];
  role: "dandelion" | "extension";
}) {
  const text = input.combined;
  const normalizedTitle = normalizeText(input.title);

  if (input.role === "dandelion") {
    const dandelionTitle = createDandelionTitle(input.combined, input.tags);

    if (dandelionTitle) {
      return dandelionTitle;
    }
  }

  if (looksLowSignal(normalizedTitle)) {
    const contextualTitle = deriveContextualTitle(text);

    if (contextualTitle) {
      return contextualTitle;
    }
  }

  if (input.tags.includes("文案")) {
    return "节点标题质量";
  }

  if (text.includes("悬停") && text.includes("标签")) {
    return "标签悬停热区";
  }

  if (text.includes("延伸块") && (text.includes("大小") || text.includes("显示"))) {
    return "延伸块自适应尺寸";
  }

  if (input.tags.includes("自动捕捉") && input.tags.includes("碎片")) {
    return "碎片自动生成边界";
  }

  if (input.tags.includes("视角")) {
    return "一阵风换视角";
  }

  if (input.tags.includes("画布") && input.tags.includes("关系线")) {
    return "画布连线可读性";
  }

  if (input.tags.includes("延伸") && input.tags.includes("关系线")) {
    return "延伸关系网络";
  }

  if (input.tags.includes("碎片") && input.tags.includes("相关度")) {
    return "碎片相关度布局";
  }

  if (input.tags.includes("画布") && input.tags.includes("聚类")) {
    return "画布分类聚类";
  }

  if (input.tags.includes("交互") && input.tags.includes("碎片")) {
    return "碎片池交互";
  }

  return cleanTitle(input.title || input.source);
}

function summarizeIdea(input: {
  text: string;
  combined: string;
  tags: string[];
  title: string;
  role: "dandelion" | "extension";
}) {
  const normalized = normalizeText(input.text);
  const { tags, title } = input;

  if (input.role === "dandelion") {
    const dandelionSummary = summarizeDandelion(input.combined, tags);

    if (dandelionSummary) {
      return dandelionSummary;
    }
  }

  if (tags.includes("文案")) {
    return "标题和简介需要结合上下文，保证单独可读。";
  }

  if (input.combined.includes("悬停") && input.combined.includes("标签")) {
    return "扩大标签悬停热区，避免移动时消失。";
  }

  if (
    input.combined.includes("延伸块") &&
    (input.combined.includes("大小") || input.combined.includes("显示"))
  ) {
    return "按内容长度调整节点尺寸，尽量完整展示简介。";
  }

  if (tags.includes("自动捕捉") && tags.includes("碎片")) {
    return "自动碎片宁缺毋滥，避免固定触发泛滥。";
  }

  const contextualSummary = deriveContextualSummary(input.combined);
  if (contextualSummary) {
    return contextualSummary;
  }

  if (tags.includes("画布") && tags.includes("关系线")) {
    return "关注画布连线和块的排版可读性。";
  }

  if (tags.includes("碎片") && tags.includes("相关度")) {
    return "按相关度决定碎片离中心的远近。";
  }

  if (tags.includes("延伸") && tags.includes("关系线")) {
    return "用关系线表达延伸之间的逻辑生长。";
  }

  if (tags.includes("聚类")) {
    return "把相近想法聚到一起，但暂不急着合并。";
  }

  if (tags.includes("视角")) {
    return "在思维变乱时切换观察角度。";
  }

  if (tags.includes("交互") && tags.includes("碎片")) {
    return "用低打扰交互管理游离碎片。";
  }

  if (tags.includes("延伸")) {
    return "记录中心想法继续长出的方向。";
  }

  if (tags.includes("关系线")) {
    return "把想法之间的关系显式呈现。";
  }

  if (tags.includes("画布") || tags.includes("布局")) {
    return "让画布结构能被快速读懂。";
  }

  const firstMeaningfulClause = normalized
    .split(/[。！？!?；;\n]/)
    .map((part) => cleanLead(part))
    .find((part) => part.length > 8 && part !== title);

  return `${(firstMeaningfulClause || normalized || title).slice(0, 34)}。`;
}

function createDandelionTitle(text: string, tags: string[]) {
  if (
    tags.includes("画布") &&
    tags.includes("关系线") &&
    tags.includes("文案")
  ) {
    return "蒲公英图的文案与连线体验";
  }

  if (text.includes("学会") && text.includes("宏观") && text.includes("微观")) {
    return "学习路径：先宏观后微观";
  }

  if (tags.includes("画布") && tags.includes("关系线")) {
    return "蒲公英图的关系可读性";
  }

  if (tags.includes("文案")) {
    return "蒲公英图的表达质量";
  }

  return "";
}

function summarizeDandelion(text: string, tags: string[]) {
  if (
    tags.includes("画布") &&
    tags.includes("关系线") &&
    tags.includes("文案")
  ) {
    return "这颗蒲公英关注右侧画布如何被读懂：中心负责解释整体主题，延伸用高质量标题承载分支，连线用有节奏的路径表达关系。";
  }

  if (text.includes("学会") && text.includes("宏观") && text.includes("微观")) {
    return "这颗蒲公英把学习方法整理成一条路径：先从宏观确认方向和目标，再进入微观细节推进。";
  }

  if (tags.includes("画布") && tags.includes("关系线")) {
    return "这颗蒲公英讨论画布中的关系表达：节点要能独立阅读，连线要辅助理解，而不是遮挡或制造噪音。";
  }

  if (tags.includes("文案")) {
    return "这颗蒲公英讨论节点如何表达自身：标题要概括主题，说明要补足上下文，让用户不依赖原对话也能看懂。";
  }

  return "";
}

function cleanTitle(value: string) {
  const [firstClause] = normalizeText(value)
    .split(/[。！？!?；;，,\n]/)
    .map((part) => cleanLead(part))
    .filter(Boolean);

  return (firstClause || cleanLead(value)).slice(0, 18);
}

function cleanLead(value: string) {
  return normalizeText(value)
    .replace(/^(当|如果|因为|所以|然后|以及|但是|不过)+/u, "")
    .replace(/^(我觉得|我认为|我发现|其实|就是|这个|那个|现在|目前|可能|应该|需要)+/u, "")
    .replace(/^(我想|我希望|我需要|可以|要不要)+/u, "")
    .replace(/^[，,、\s]+/u, "")
    .trim();
}

function looksLowSignal(value: string) {
  return /[a-zA-Z0-9]/u.test(value) || /(比较重要|都重要|很重要|关键|应该|需要|先.*再.*)/u.test(value);
}

function deriveContextualTitle(text: string) {
  const sequenceMatch = text.match(
    /先([^，。！？!?；;\n]{1,10})[，,]?(?:再|然后)([^，。！？!?；;\n]{1,10})/
  );

  if (sequenceMatch) {
    return `先${cleanLead(sequenceMatch[1])}后${cleanLead(sequenceMatch[2])}`.slice(
      0,
      18
    );
  }

  const keyMatch = text.match(/这是([^，。！？!?；;\n]{1,12})的关键/);

  if (keyMatch) {
    return `${cleanLead(keyMatch[1])}关键`.slice(0, 18);
  }

  if (text.includes("学会") && text.includes("关键")) {
    return "学会关键";
  }

  if (text.includes("重要") && text.includes("宏观") && text.includes("微观")) {
    return "先宏观后微观";
  }

  return "";
}

function deriveContextualSummary(text: string) {
  if (text.includes("先宏观") && text.includes("微观")) {
    return "学会的关键是先从宏观把握方向，再往微观推进。";
  }

  if (text.includes("标签") && text.includes("悬停")) {
    return "把标签区做成连续热区，避免鼠标移动时消失。";
  }

  if (text.includes("延伸块") && text.includes("大小")) {
    return "让延伸块按内容长度变宽变高，尽量完整显示简介。";
  }

  return "";
}

function normalizeText(value: string) {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}
