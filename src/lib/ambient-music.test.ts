import { describe, expect, it } from "vitest";

import {
  getAmbientMusicButtonCopy,
  getAmbientMusicStatusCopy
} from "./ambient-music";

describe("ambient music copy", () => {
  it("uses explicit play and pause labels because browsers require a user gesture", () => {
    expect(getAmbientMusicButtonCopy(false)).toBe("开启纯音乐");
    expect(getAmbientMusicButtonCopy(true)).toBe("暂停纯音乐");
  });

  it("explains that the music is local generated ambient sound", () => {
    expect(getAmbientMusicStatusCopy(false)).toContain("点击后播放");
    expect(getAmbientMusicStatusCopy(true)).toContain("本地生成");
  });
});
