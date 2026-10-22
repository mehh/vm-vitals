import type { Report } from "@/lib/types";
import { healthScore, heartbeatBpm, moodFor, scoreColor } from "@/lib/vitals";
import { Gauge } from "./Gauge";
import { Heartbeat } from "./Heartbeat";

/** Score ring, mood, quip, and a live EKG strip. Server-safe. */
export function MoodCard({ report, offline, openSeverities, compact = false }: { report: Report | null; offline: boolean; openSeverities: string[]; compact?: boolean }) {
  const input = { report, offline, openSeverities };
  const score = healthScore(input);
  const mood = moodFor(input);
  const bpm = offline ? 0 : heartbeatBpm(report);
  const color = report ? scoreColor(score, offline) : "var(--info)";
  return (
    <section className={`card card-glow relative flex h-full flex-col overflow-hidden ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-center gap-5">
        <Gauge pct={report && !offline ? score : 0} color={color} size={compact ? 92 : 112} stroke={9}>
          <div className="mono text-3xl font-bold" style={{ color }}>
            {report && !offline ? score : "–"}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted">score</div>
        </Gauge>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-widest text-muted">your bot&apos;s heartbeat</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`text-2xl ${mood.key === "thriving" || mood.key === "humming" ? "float" : ""}`} aria-hidden>
              {mood.emoji}
            </span>
            <h2 className="text-xl font-semibold tracking-tight">{mood.label}</h2>
          </div>
          <p className="mt-1 text-sm text-secondary">{mood.quip}</p>
          <div className="mono mt-2 text-xs text-muted">
            {bpm ? `${bpm} bpm` : offline ? "no pulse" : "listening…"}
            {report && !offline && report.jobs.length > 0 ? ` · ${report.jobs.length} agent job${report.jobs.length === 1 ? "" : "s"} awake` : ""}
          </div>
        </div>
      </div>
      <div className="-mx-1 mt-auto pt-4">
        <Heartbeat bpm={bpm} color={color} height={compact ? 36 : 44} />
      </div>
    </section>
  );
}
