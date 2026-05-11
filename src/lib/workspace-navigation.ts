export function getWorkspaceNodeHref(nodeId: string) {
  return `/workspace?node_id=${encodeURIComponent(nodeId)}`;
}

export function getNewDandelionDraft() {
  return {
    title: "新的蒲公英",
    content: "从这里开始倾倒一个新的想法。"
  };
}
