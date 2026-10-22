import Link from "next/link";
import { getViewer, myMachines } from "@/lib/auth";
import { ago, osLabel } from "@/lib/format";
import { OFFLINE_AFTER_MS } from "@/lib/types";
import { healthScore, moodFor, rootDisk, scoreColor } from "@/lib/vitals";
import { BotPromptCard } from "@/components/BotPromptCard";
import { Heartbeat } from "@/components/Heartbeat";
import { Gauge } from "@/components/Gauge";
import { Meter } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ claim?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const machines = await myMachines(viewer);

  return (
    <div className="space-y-14">
      {sp.claim === "ok" && (
        <div className="card border-good/40 px-4 py-3 text-sm">
          Signed in as <span className="mono">{viewer.email}</span>. Your machines now follow that email.
        </div>
      )}
      {sp.claim === "invalid" && <div className="card border-critical/40 px-4 py-3 text-sm">That link is expired or already used. Request a new one from a machine page.</div>}

      <section className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-start">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1/70 px-3 py-1 text-xs text-secondary">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-good pulse" />
            for the computer your bot lives on
          </div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Is my bot&apos;s computer <span className="gradient-text">okay</span>?
          </h1>
          <div className="max-w-md">
            <Heartbeat bpm={72} color="var(--series-1)" height={48} />
          </div>
          <p className="max-w-prose text-lg text-secondary">
            Your Grok Bot runs all night on a VM you forgot the password to. VM Vitals gives it a heartbeat you can watch from your phone.
            A health score, a mood, live gauges and squiggly charts for CPU, memory, disk and network. Alerts before the disk fills or the
            OOM killer eats your agent. A share card for X when it&apos;s having a good day.
          </p>
          <ul className="grid gap-2 text-sm text-secondary sm:grid-cols-2">
            <Feature color="var(--series-1)">Live gauges and sparklines, refreshed every 15 seconds.</Feature>
            <Feature color="var(--series-2)">Which agent jobs are awake, and for how long.</Feature>
            <Feature color="var(--series-3)">Alerts for full disks, OOM kills, dead jobs and silence.</Feature>
            <Feature color="var(--series-5)">Numbers and process names only. Never env vars or files.</Feature>
          </ul>
          <p className="text-sm text-muted">
            No signup. The bot pairs itself with a token.{" "}
            <Link href="/privacy" className="underline decoration-border underline-offset-4 hover:text-primary">
              See exactly what gets sent
            </Link>
          </p>
        </div>
        <div id="install">
          <BotPromptCard />
        </div>
      </section>

      {machines.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your bots&apos; computers</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {machines.map((m) => {
              const seen = m.last_seen_at ? new Date(m.last_seen_at) : null;
              const offline = !seen || Date.now() - seen.getTime() > OFFLINE_AFTER_MS;
              const r = m.last_report;
              const disk = rootDisk(r);
              const input = { report: r, offline, openSeverities: [] as string[] };
              const score = healthScore(input);
              const mood = moodFor(input);
              const color = r ? scoreColor(score, offline) : "var(--info)";
              return (
                <li key={m.id}>
                  <Link href={`/m/${m.id}`} className="card block p-4 transition hover:border-[#4a5068]">
                    <div className="flex items-center gap-3">
                      <Gauge pct={r && !offline ? score : 0} color={color} size={56} stroke={9}>
                        <span className="mono text-sm font-bold" style={{ color }}>
                          {r && !offline ? score : "–"}
                        </span>
                      </Gauge>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span aria-hidden>{mood.emoji}</span>
                          <div className="truncate font-medium">{m.name}</div>
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          {mood.label} · {osLabel(m.os)} {m.arch} · {offline ? `last seen ${ago(seen)}` : ago(seen)}
                        </div>
                      </div>
                    </div>
                    {r && (
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-secondary">
                        <MiniMeter label="cpu" pct={r.cpu.pct} color="var(--series-1)" />
                        <MiniMeter label="mem" pct={r.mem.pct} color="var(--series-2)" />
                        <MiniMeter label="disk" pct={disk?.pct ?? null} color="var(--series-3)" />
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-3">
        <Step n={1} title="Get a prompt">
          Click the big button. You get a chat message with a one-time token baked in. It&apos;s tied to this browser, nothing else.
        </Step>
        <Step n={2} title="Paste it into your bot">
          Grok Bot, Claude Code, Codex, whatever drives the machine. It runs one line, installs a tiny service, and tells you the link.
        </Step>
        <Step n={3} title="Watch the heartbeat">
          About 30 seconds later the gauges light up. Flip on sharing and post the card when your bot is thriving. Or when it isn&apos;t.
        </Step>
      </section>
    </div>
  );
}

function Feature({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      <span>{children}</span>
    </li>
  );
}

function MiniMeter({ label, pct, color }: { label: string; pct: number | null; color: string }) {
  return (
    <div>
      <div className="mono flex justify-between">
        <span style={{ color }}>{label}</span>
        <span>{pct == null ? "–" : `${Math.round(pct)}%`}</span>
      </div>
      <div className="mt-1">
        <Meter pct={pct} />
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mono text-xs text-muted">0{n}</div>
      <div className="mt-1 font-medium">{title}</div>
      <p className="mt-2 text-sm text-secondary">{children}</p>
    </div>
  );
}
