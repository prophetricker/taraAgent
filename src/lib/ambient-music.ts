export function getAmbientMusicButtonCopy(isPlaying: boolean) {
  return isPlaying ? "暂停纯音乐" : "开启纯音乐";
}

export function getAmbientMusicStatusCopy(isPlaying: boolean) {
  return isPlaying
    ? "本地生成的低音量环境纯音乐正在播放。"
    : "点击后播放本地生成的低音量环境纯音乐。";
}
