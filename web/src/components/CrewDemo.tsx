"use client";

import { useEffect, useState } from "react";
import { Critter, STATUS, exprFor, grokExpr, moodHex } from "./Critters";
import type { MoodKey } from "@/lib/vitals";

/** A scripted night on a bot's box, so the landing page shows the crew reacting. */
const SCENES: { at: string; say: string; cpu: number; mem: number; disk: number; net: number; mood: MoodKey; score: number }[] = [
  { at: "03:12", say: "idle. everyone's fine.", cpu: 6, mem: 38, disk: 52, net: 18, mood: "thriving", score: 98 },
  { at: "03:14", say: "claude code wakes up", cpu: 66, mem: 58, disk: 52, net: 45, mood: "humming", score: 86 },
  { at: "03:15", say: "npm install. again.", cpu: 90, mem: 74, disk: 63, net: 82, mood: "sweating", score: 64 },
  { at: "03:16", say: "node_modules ate the disk", cpu: 71, mem: 81, disk: 96, net: 40, mood: "wheezing", score: 37 },
  { at: "03:19", say: "you ran pnpm store prune", cpu: 24, mem: 55, disk: 64, net: 22, mood: "humming", score: 88 },
  { at: "03:20", say: "back to thriving", cpu: 9, mem: 44, disk: 61, net: 12, mood: "thriving", score: 96 },
];

const NAMES = { chip: ["chip", "cpu"], mem: ["mimi", "mem"], disk: ["stash", "disk"], net: ["ping", "net"] } as const;

export function CrewDemo() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % SCENES.length), 2800);
    return () => clearInterval(t);
  }, []);
  const s = SCENES[i];
  const friends = [
    { kind: "chip", v: s.cpu },
    { kind: "mem", v: s.mem },
    { kind: "disk", v: s.disk },
    { kind: "net", v: s.net },
  ] as const;

  return (
    <figure className="relative select-none" aria-label="Grok Bot and its agent friends reacting to a busy night on a machine">
      <div className="flex items-end justify-center gap-6">
        <Critter kind="grok" id="hero-grok" expr={grokExpr(s.mood)} light={moodHex(s.mood)} size={196} beat={s.mood === "thriving" ? 1.2 : 0.6} className="h-36 w-36 sm:h-[196px] sm:w-[196px]" />
        <div className="mb-4 w-28 text-left sm:mb-6 sm:w-36">
          <div className="kicker">health</div>
          <div className="display text-5xl sm:text-6xl" style={{ color: s.score < 55 ? STATUS.bad : s.score < 75 ? STATUS.warn : undefined }}>
            {s.score}
          </div>
          <div className="mt-1 text-xs text-muted">grok-mini · {s.mood}</div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-4">
        {friends.map((f, k) => (
          <div key={f.kind} className="flex flex-col items-center">
            <Critter
              kind={f.kind}
              id={`hero-${f.kind}`}
              level={f.v}
              expr={f.kind === "net" ? (f.v > 80 ? "busy" : exprFor(f.v)) : exprFor(f.v)}
              liquid={f.kind === "net" ? "#ffffff" : undefined}
              size={84}
              delay={k * 0.45}
            />
            <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">{NAMES[f.kind][0]}</div>
            <div className="text-sm font-bold">
              {f.kind === "net" ? `${f.v * 12}KB/s` : `${f.v}%`} {f.kind !== "net" && <span className="text-[10px] font-normal text-muted">{NAMES[f.kind][1]}</span>}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-6 border-t border-line pt-3 text-xs text-muted">
        <span className="text-fg-2">{s.at}</span> · {s.say}
        <span className="cursor" aria-hidden />
      </figcaption>
    </figure>
  );
}
