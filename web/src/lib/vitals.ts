/**
 * Health score and mood for a machine. Pure, client-safe, shared by the
 * dashboard, share page and OG image. Scores are a vibe, not an SLA.
 */
import type { Report } from "./types";

export interface VitalsInput {
  report: Report | null;
  offline: boolean;
  openSeverities: string[];
}

export type MoodKey = "waiting" | "ghosted" | "thriving" | "humming" | "sweating" | "wheezing" | "flatlining";

export interface Mood {
  key: MoodKey;
  emoji: string;
  label: string;
  quip: string;
  /** CSS color token for the mood. */
  color: string;
}

const MOODS: Record<MoodKey, Omit<Mood, "key">> = {
  waiting: { emoji: "👀", label: "Warming up", quip: "Paired. First heartbeat lands in about 30 seconds.", color: "var(--info)" },
  ghosted: { emoji: "💤", label: "Gone quiet", quip: "No heartbeat for two minutes. Asleep, unplugged, or sulking.", color: "var(--text-muted)" },
  thriving: { emoji: "😎", label: "Thriving", quip: "Cool, fed, and a little bored. Give it more work.", color: "var(--good)" },
  humming: { emoji: "🙂", label: "Humming along", quip: "Working, not sweating. Exactly how you want it.", color: "var(--good)" },
  sweating: { emoji: "😅", label: "Sweating a bit", quip: "Something's tight. Look for the amber bar.", color: "var(--warning)" },
  wheezing: { emoji: "😰", label: "Wheezing", quip: "This box needs help before the OOM killer helps it.", color: "var(--warning)" },
  flatlining: { emoji: "🥵", label: "Flatlining", quip: "Critical. Free some disk or memory right now.", color: "var(--critical)" },
};

export function rootDisk(r: Report | null | undefined) {
  if (!r) return undefined;
  return r.disks.find((d) => d.mount === "/") ?? r.disks[0];
}

/** 0..100. 100 is a happy idle box; the OOM killer lives near 0. */
export function healthScore(input: VitalsInput): number {
  const r = input.report;
  if (!r || input.offline) return 0;
  let s = 100;
  const over = (v: number, from: number, w: number) => Math.max(0, v - from) * w;
  s -= over(r.cpu.pct, 80, 0.5);
  s -= over(r.mem.pct, 75, 1.2);
  s -= over(rootDisk(r)?.pct ?? 0, 70, 1.5);
  if (r.swap.total_b > 0) s -= over(r.swap.pct, 50, 0.3);
  if (r.cpu.cores > 0) s -= over(r.load.l5 / r.cpu.cores, 1.5, 8);
  let alertHit = 0;
  for (const sev of input.openSeverities) alertHit += sev === "critical" ? 15 : sev === "warning" ? 5 : 2;
  s -= Math.min(30, alertHit);
  return Math.max(0, Math.min(100, Math.round(s)));
}

export function moodFor(input: VitalsInput): Mood {
  const pick = (key: MoodKey): Mood => ({ key, ...MOODS[key] });
  if (!input.report) return pick("waiting");
  if (input.offline) return pick("ghosted");
  const s = healthScore(input);
  if (s >= 90) return pick("thriving");
  if (s >= 75) return pick("humming");
  if (s >= 55) return pick("sweating");
  if (s >= 30) return pick("wheezing");
  return pick("flatlining");
}

/** A playful pulse. Idle box rests near 60; a hot one races. */
export function heartbeatBpm(r: Report | null | undefined): number {
  if (!r) return 0;
  const loadRatio = r.cpu.cores > 0 ? r.load.l1 / r.cpu.cores : 0;
  return Math.round(Math.min(180, 58 + r.cpu.pct * 0.7 + Math.min(3, loadRatio) * 12));
}

export function bps(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "–";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function scoreColor(score: number, offline = false): string {
  if (offline) return "var(--text-muted)";
  if (score >= 75) return "var(--good)";
  if (score >= 55) return "var(--warning)";
  return "var(--critical)";
}
