import { describe, expect, it } from "vitest";

import {
  getCanvasOnboardingCards,
  getChatOnboardingPrompts,
  shouldShowCanvasOnboarding
} from "./onboarding";

describe("workspace onboarding", () => {
  it("shows right-brain onboarding only when the dandelion has no growth yet", () => {
    expect(
      shouldShowCanvasOnboarding({
        extensionCount: 0,
        fragmentCount: 0
      })
    ).toBe(true);
    expect(
      shouldShowCanvasOnboarding({
        extensionCount: 1,
        fragmentCount: 0
      })
    ).toBe(false);
    expect(
      shouldShowCanvasOnboarding({
        extensionCount: 0,
        fragmentCount: 1
      })
    ).toBe(false);
  });

  it("explains the four core graph concepts without forcing a tutorial", () => {
    expect(getCanvasOnboardingCards().map((card) => card.title)).toEqual([
      "蒲公英中心",
      "延伸",
      "碎片",
      "关系线"
    ]);
    expect(getCanvasOnboardingCards()[0].body).toContain("起点");
    expect(getCanvasOnboardingCards()[1].body).toContain("继续生长");
  });

  it("offers concrete first-message prompts for the empty chat state", () => {
    expect(getChatOnboardingPrompts()).toEqual([
      "我脑子里有一个还没成形的想法，它大概是...",
      "我现在卡住的是...",
      "先别帮我做计划，只陪我把这个想法说清楚：..."
    ]);
  });
});
