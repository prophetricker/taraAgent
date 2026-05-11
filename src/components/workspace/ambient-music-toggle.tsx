"use client";

import { useEffect, useRef, useState } from "react";

import {
  getAmbientMusicButtonCopy,
  getAmbientMusicStatusCopy
} from "@/lib/ambient-music";

type AmbientAudioGraph = {
  context: AudioContext;
  masterGain: GainNode;
  oscillators: OscillatorNode[];
  lfos: OscillatorNode[];
};

export function AmbientMusicToggle() {
  const [isPlaying, setIsPlaying] = useState(false);
  const graphRef = useRef<AmbientAudioGraph | null>(null);

  useEffect(
    () => () => {
      void stopAmbientMusic(graphRef.current);
      graphRef.current = null;
    },
    []
  );

  async function toggleMusic() {
    if (isPlaying) {
      await stopAmbientMusic(graphRef.current);
      graphRef.current = null;
      setIsPlaying(false);
      return;
    }

    graphRef.current = await startAmbientMusic();
    setIsPlaying(true);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggleMusic}
        className="rounded-full border border-[#667a4d]/20 bg-white/55 px-4 py-2 text-xs font-semibold text-[#4f5f2d] shadow-sm shadow-stone-900/10 transition hover:bg-[#fff8e8]"
        aria-pressed={isPlaying}
      >
        {getAmbientMusicButtonCopy(isPlaying)}
      </button>
      <span className="text-[10px] leading-4 text-stone-500">
        {getAmbientMusicStatusCopy(isPlaying)}
      </span>
    </div>
  );
}

async function startAmbientMusic(): Promise<AmbientAudioGraph> {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  const context = new AudioContextClass();

  if (context.state === "suspended") {
    await context.resume();
  }

  const masterGain = context.createGain();
  masterGain.gain.setValueAtTime(0.0001, context.currentTime);
  masterGain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 1.8);
  masterGain.connect(context.destination);

  const oscillators = createToneLayer(context, masterGain);
  const lfos = createSlowModulation(context, masterGain);

  return {
    context,
    masterGain,
    oscillators,
    lfos
  };
}

function createToneLayer(context: AudioContext, destination: AudioNode) {
  const notes = [146.83, 220, 329.63];

  return notes.map((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(index === 0 ? 0.22 : 0.1, context.currentTime);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();

    return oscillator;
  });
}

function createSlowModulation(context: AudioContext, masterGain: GainNode) {
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();

  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.035, context.currentTime);
  lfoGain.gain.setValueAtTime(0.012, context.currentTime);
  lfo.connect(lfoGain);
  lfoGain.connect(masterGain.gain);
  lfo.start();

  return [lfo];
}

async function stopAmbientMusic(graph: AmbientAudioGraph | null) {
  if (!graph) {
    return;
  }

  const stopAt = graph.context.currentTime + 0.45;

  graph.masterGain.gain.cancelScheduledValues(graph.context.currentTime);
  graph.masterGain.gain.setValueAtTime(
    Math.max(graph.masterGain.gain.value, 0.0001),
    graph.context.currentTime
  );
  graph.masterGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  window.setTimeout(() => {
    for (const oscillator of [...graph.oscillators, ...graph.lfos]) {
      oscillator.stop();
      oscillator.disconnect();
    }

    graph.masterGain.disconnect();
    void graph.context.close();
  }, 520);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
