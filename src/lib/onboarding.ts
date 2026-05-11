export type OnboardingCard = {
  title: string;
  body: string;
};

export function shouldShowCanvasOnboarding(input: {
  extensionCount: number;
  fragmentCount: number;
}) {
  return input.extensionCount === 0 && input.fragmentCount === 0;
}

export function getCanvasOnboardingCards(): OnboardingCard[] {
  return [
    {
      title: "蒲公英中心",
      body: "这里是这颗想法的起点，负责说明它从哪里发起。"
    },
    {
      title: "延伸",
      body: "你继续说下去时，系统会把主线里继续生长的部分放到中心附近。"
    },
    {
      title: "碎片",
      body: "偏离当前主线、但值得保留的想法会游离在外围，之后可成长为新蒲公英。"
    },
    {
      title: "关系线",
      body: "线条表达推导、联想、支撑、冲突等关系；点线可以手动校正。"
    }
  ];
}

export function getChatOnboardingPrompts() {
  return [
    "我脑子里有一个还没成形的想法，它大概是...",
    "我现在卡住的是...",
    "先别帮我做计划，只陪我把这个想法说清楚：..."
  ];
}
