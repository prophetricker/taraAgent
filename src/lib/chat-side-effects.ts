import { shouldAttemptDandelionExtraction } from "./dandelion-extractor";

export type ChatSideEffectPlan = {
  updateDandelionCenter: boolean;
  attemptFragmentExtraction: boolean;
  maxAdditionalModelCalls: 0 | 1;
};

export function getChatSideEffectPlan(input: {
  userMessageCount: number;
  userMessage: string;
  providerFailed: boolean;
}): ChatSideEffectPlan {
  if (input.providerFailed) {
    return {
      updateDandelionCenter: false,
      attemptFragmentExtraction: false,
      maxAdditionalModelCalls: 0
    };
  }

  const updateDandelionCenter =
    input.userMessageCount <= 1 || input.userMessageCount % 2 === 0;
  const attemptFragmentExtraction =
    !updateDandelionCenter && shouldAttemptDandelionExtraction(input.userMessage);

  return {
    updateDandelionCenter,
    attemptFragmentExtraction,
    maxAdditionalModelCalls:
      updateDandelionCenter || attemptFragmentExtraction ? 1 : 0
  };
}
