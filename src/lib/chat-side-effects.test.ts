import { describe, expect, it } from "vitest";

import { getChatSideEffectPlan } from "./chat-side-effects";

describe("getChatSideEffectPlan", () => {
  it("caps extra model work to one call per user message", () => {
    const plan = getChatSideEffectPlan({
      userMessageCount: 2,
      userMessage:
        "我正在整理蒲公英中心。与此同时我还想到一个以后再看的离线采集入口，它现在不该打断主线。",
      providerFailed: false
    });

    expect(plan.updateDandelionCenter).toBe(true);
    expect(plan.attemptFragmentExtraction).toBe(false);
    expect(plan.maxAdditionalModelCalls).toBe(1);
  });

  it("lets strict fragment extraction run only when summary is not scheduled", () => {
    const plan = getChatSideEffectPlan({
      userMessageCount: 3,
      userMessage:
        "我正在整理蒲公英中心，它现在应该继续服务当前画布主线，不要被随手想到的内容打断。与此同时我还想到一个以后再看的离线采集入口，它可以独立成为另一个入口，现在不该打断主线。",
      providerFailed: false
    });

    expect(plan.updateDandelionCenter).toBe(false);
    expect(plan.attemptFragmentExtraction).toBe(true);
  });

  it("skips all extra model work after a provider failure", () => {
    expect(
      getChatSideEffectPlan({
        userMessageCount: 3,
        userMessage:
          "我正在整理蒲公英中心，它现在应该继续服务当前画布主线，不要被随手想到的内容打断。与此同时我还想到一个以后再看的离线采集入口，它可以独立成为另一个入口，现在不该打断主线。",
        providerFailed: true
      })
    ).toMatchObject({
      updateDandelionCenter: false,
      attemptFragmentExtraction: false
    });
  });
});
