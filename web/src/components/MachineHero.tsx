import type { Report } from "@/lib/types";
import { healthScore, heartbeatBpm, moodFor } from "@/lib/vitals";
import { Critter, STATUS, grokExpr, moodHex } from "./Critters";
import { Heartbeat } from "./Heartbeat";

/** Grok Bot, the score, the mood and a live EKG. Server-safe; shared by the dashboard and share page. */
export function MachineHero({
  id,
  name,
  kicker,
  meta,
  report,
  offline,
  openSeverities,
  actions,
}: {
  id: string;
  name: string;
  kicker: string;
  meta: React.ReactNode;
  report: Report | null;
  offline: boolean;
  openSeverities: string[];
  actions?: React.ReactNode;
}) {
  const input = { report, offline, openSeverities };
  const score = healthScore(input);
  const mood = moodFor(input);
  const bpm = offline ? 0 : heartbeatBpm(report);
  const light = moodHex(mood.key);
  const live = !!report && !offline;
  const scoreColor = !live ? STATUS.dim : score < 55 ? STATUS.bad : score < 75 ? STATUS.warn : undefined;
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="wrap relative py-10 md:py-14">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="kicker">{kicker}</div>
            <h1 className="display mt-3 break-words text-4xl sm:text-6xl">{name}</h1>
            <div className="mt-3 text-xs text-muted">{meta}</div>
          </div>
          {actions}
        </div>

        <div className="mt-10 grid grid-cols-1 items-center gap-8 md:grid-cols-[auto_1fr_auto]">
          <Critter
            kind="grok"
            id={`hero-${id}`}
            expr={grokExpr(mood.key)}
            light={light}
            size={180}
            beat={bpm ? 60 / bpm : undefined}
            className="h-32 w-32 sm:h-[180px] sm:w-[180px]"
            label={`Grok Bot, ${mood.label.toLowerCase()}`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: light }} aria-hidden />
              {mood.label.toLowerCase()}
            </div>
            <p className="mt-2 max-w-lg text-sm text-fg-2">{mood.quip}</p>
            <div className="mt-2 text-xs text-muted">
              {bpm ? `${bpm} bpm, from cpu and load` : offline ? "no pulse" : "listening…"}
              {live && report.jobs.length > 0 ? ` · ${report.jobs.length} agent job${report.jobs.length === 1 ? "" : "s"} awake` : ""}
            </div>
            <div className="mt-4 max-w-xl">
              <Heartbeat bpm={bpm} color={offline ? STATUS.dim : "#ffffff"} height={40} />
            </div>
          </div>
          <div className="md:text-right">
            <div className="kicker">health / 100</div>
            <div className="display mt-1 text-8xl sm:text-9xl" style={{ color: scoreColor }} data-testid="score">
              {live ? score : "–"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
