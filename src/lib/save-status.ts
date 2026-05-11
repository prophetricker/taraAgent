export type SaveStatusState = "idle" | "saving" | "saved" | "failed";

export type SaveStatus = {
  state: SaveStatusState;
  target: string;
  detail?: string;
};

export function getSaveStatusCopy(status: SaveStatus) {
  switch (status.state) {
    case "saving":
      return `正在保存${status.target}...`;
    case "saved":
      return `${status.target}已保存`;
    case "failed":
      return status.detail
        ? `${status.target}保存失败：${status.detail}`
        : `${status.target}保存失败`;
    case "idle":
    default:
      return "";
  }
}

export function shouldShowSaveStatus(
  status: SaveStatus | null
): status is SaveStatus {
  return Boolean(status && status.state !== "idle");
}

export function getSaveStatusToneClass(status: SaveStatus) {
  switch (status.state) {
    case "saving":
      return "border-[#667a4d]/20 bg-[#fff8e8]/88 text-[#667a4d]";
    case "saved":
      return "border-[#667a4d]/20 bg-[#fff8e8]/88 text-[#667a4d]";
    case "failed":
      return "border-red-900/10 bg-red-50/90 text-red-800";
    case "idle":
    default:
      return "border-stone-900/10 bg-[#fff8e8]/80 text-stone-500";
  }
}
