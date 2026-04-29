import { describe, expect, it } from "vitest";

import { buildGuardianSystemPrompt } from "./prompt";

describe("buildGuardianSystemPrompt", () => {
  it("keeps listener mode non-summarizing and forbids todo lists", () => {
    const prompt = buildGuardianSystemPrompt("listener");

    expect(prompt).toContain("共鸣发散期");
    expect(prompt).toContain("绝对禁止");
    expect(prompt).toContain("To-Do List");
    expect(prompt).toContain("不要主动总结");
    expect(prompt).not.toContain("create_dandelion_fragment");
  });

  it("keeps socrates mode focused on one grounding question", () => {
    const prompt = buildGuardianSystemPrompt("socrates");

    expect(prompt).toContain("扎根收敛期");
    expect(prompt).toContain("只提出一个问题");
    expect(prompt).toContain("反直觉提问");
  });
});
