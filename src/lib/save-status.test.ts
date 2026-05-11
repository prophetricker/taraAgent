import { describe, expect, it } from "vitest";

import {
  getSaveStatusCopy,
  getSaveStatusToneClass,
  shouldShowSaveStatus
} from "./save-status";

describe("getSaveStatusCopy", () => {
  it("returns concise copy for save lifecycle states", () => {
    expect(getSaveStatusCopy({ state: "saving", target: "关系" })).toBe(
      "正在保存关系..."
    );
    expect(getSaveStatusCopy({ state: "saved", target: "碎片" })).toBe(
      "碎片已保存"
    );
    expect(getSaveStatusCopy({ state: "failed", target: "节点位置" })).toBe(
      "节点位置保存失败"
    );
  });

  it("allows the caller to include a failure reason", () => {
    expect(
      getSaveStatusCopy({
        state: "failed",
        target: "关系",
        detail: "刚才的线条修改已经回滚"
      })
    ).toBe("关系保存失败：刚才的线条修改已经回滚");
  });

  it("hides idle status and maps active states to visual tones", () => {
    expect(shouldShowSaveStatus(null)).toBe(false);
    expect(shouldShowSaveStatus({ state: "idle", target: "关系" })).toBe(false);
    expect(shouldShowSaveStatus({ state: "saving", target: "关系" })).toBe(true);

    expect(getSaveStatusToneClass({ state: "saving", target: "关系" })).toContain(
      "border-[#667a4d]/20"
    );
    expect(getSaveStatusToneClass({ state: "saved", target: "关系" })).toContain(
      "text-[#667a4d]"
    );
    expect(getSaveStatusToneClass({ state: "failed", target: "关系" })).toContain(
      "text-red-800"
    );
  });
});
