import Link from "next/link";
import { getViewer, myMachines } from "@/lib/auth";
import { one } from "@/lib/db";
import { ago, appUrl, osLabel } from "@/lib/format";
import { OFFLINE_AFTER_MS } from "@/lib/types";
import { healthScore, moodFor } from "@/lib/vitals";
import { crewFor } from "@/lib/crew";
import { SITE, src } from "@/lib/site";
import { CREW, Critter, grokExpr, moodHex, type Kind } from "@/components/Critters";
import { CrewDemo } from "@/components/CrewDemo";
import { PromptFlow } from "@/components/PromptFlow";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };

async function liveCounts() {
  try {
    const r = await one<{ live: number; beats: number }>(
      `SELECT (SELECT count(*)::int FROM machines WHERE last_seen_at > now() - interval '2 minutes') AS live,
              (SELECT count(*)::int FROM samples WHERE at > now() - interval '1 hour') AS beats`,
    );
    return r ?? { live: 0, beats: 0 };
  } catch {
    return { live: 0, beats: 0 };
  }
}

const TICKER = [
  "disk 41% · stash is chill",
  "claude code awake 3h 12m",
  "0 oom kills since boot",
  "load 0.42 on 8 cores",
  "codex napping",
  "mimi at 58%",
  "↓ 1.2 MB/s ↑ 88 KB/s",
  "grok bot thriving · 96/100",
  "swap: none. brave.",
  "uptime 19d 4h",
];

export default async function Home({ searchParams }: { searchParams: Promise<{ claim?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const [machines, counts] = await Promise.all([myMachines(viewer), liveCounts()]);
  const host = appUrl();

  return (
    <div id="top">
      {sp.claim === "ok" && <Notice tone="ok">Signed in as {viewer.email}. Your machines follow that email now.</Notice>}
      {sp.claim === "invalid" && <Notice tone="bad">That link is expired or already used. Request a new one from a machine page.</Notice>}

      {/* hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
        <div className="wrap relative grid gap-12 py-14 md:py-24 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs text-muted">
              <span className="text-dim">$</span> grok-bot install vm-vitals --watch-my-vitals
            </p>
            <h1 className="display mt-5 text-[3.1rem] sm:text-7xl xl:text-[5.6rem]">
              is my bot&apos;s computer okay?<span className="cursor" aria-hidden />
            </h1>
            <p className="mt-6 text-sm font-bold sm:text-base">health score · moods · alerts · a share card with blobs</p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-fg-2 sm:text-[15px]">
              Your Grok Bot works all night on a box you forgot the password to. Copy one prompt, paste it to your bot, and it installs a tiny
              open-source agent on its own computer. A minute later you&apos;re watching its CPU, memory, disk and network from your phone, with a
              little crew of blobs that sweat when the box does.
            </p>
            <div className="mt-8">
              <PromptFlow host={host} />
            </div>
            <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {counts.live > 0 && (
                <>
                  <span>
                    <span className="text-fg">{counts.live}</span> machine{counts.live === 1 ? "" : "s"} reporting right now
                  </span>
                  <span className="text-dim">│</span>
                </>
              )}
              <span>
                <span className="text-fg">{counts.beats.toLocaleString("en-US")}</span> heartbeats in the last hour
                <span className="pulse ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-ok align-middle" />
              </span>
            </p>
          </div>
          <div className="min-w-0">
            <CrewDemo />
          </div>
        </div>
      </section>

      <div className="marquee border-b border-line bg-panel py-3 text-[11px] uppercase tracking-[0.16em] text-muted" aria-hidden>
        <div>
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="px-6">
              {t} <span className="pl-6 text-dim">/</span>
            </span>
          ))}
        </div>
      </div>

      {machines.length > 0 && (
        <section className="wrap pt-16">
          <SectionHead kicker="your bots' computers" title={`${machines.length} on the monitor`} />
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {machines.map((m) => {
              const seen = m.last_seen_at ? new Date(m.last_seen_at) : null;
              const offline = !seen || Date.now() - seen.getTime() > OFFLINE_AFTER_MS;
              const input = { report: m.last_report, offline, openSeverities: [] as string[] };
              const score = healthScore(input);
              const mood = moodFor(input);
              const crew = crewFor(m.last_report, offline);
              return (
                <li key={m.id}>
                  <Link href={`/m/${m.id}`} className="group flex items-center gap-4 py-4 transition-colors hover:bg-panel sm:gap-6 sm:px-3">
                    <Critter kind="grok" id={`list-${m.id}`} expr={grokExpr(mood.key)} light={moodHex(mood.key)} size={52} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold group-hover:underline">{m.name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted">
                        {mood.label.toLowerCase()} · {osLabel(m.os)} {m.arch} · {offline ? `last seen ${ago(seen)}` : ago(seen)}
                      </div>
                    </div>
                    <div className="hidden items-center gap-1 md:flex">
                      {crew.map((f) => (
                        <div key={f.kind} className="flex w-16 flex-col items-center">
                          <Critter kind={f.kind} id={`list-${m.id}-${f.kind}`} level={f.level} expr={f.expr} liquid={f.liquid} size={34} />
                          <span className="text-[10px] text-muted">
                            {f.label} {f.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="w-14 text-right">
                      <div className="display text-3xl">{m.last_report && !offline ? score : "–"}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* crew */}
      <section className="wrap pt-24">
        <SectionHead kicker="meet the crew" title="Grok Bot does the work. The blobs watch its back." />
        <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          <CrewCell kind="grok" name="Grok Bot" watches="The whole box" sweats="Its antenna is the status light. Green, amber, red, or snoring." level={null} />
          <CrewCell kind="chip" name={CREW.chip.name} watches={CREW.chip.watches} sweats={CREW.chip.sweats} level={34} />
          <CrewCell kind="mem" name={CREW.mem.name} watches={CREW.mem.watches} sweats={CREW.mem.sweats} level={63} />
          <CrewCell kind="disk" name={CREW.disk.name} watches={CREW.disk.watches} sweats={CREW.disk.sweats} level={88} />
          <CrewCell kind="net" name={CREW.net.name} watches={CREW.net.watches} sweats={CREW.net.sweats} level={45} />
        </div>
        <p className="mt-4 text-xs text-muted">Each friend fills up like a jar as its number climbs. Amber at 85%, red at 95%. Grok Bot&apos;s mood is the health score, 0 to 100.</p>
      </section>

      {/* how it works */}
      <section className="wrap grid grid-cols-1 gap-12 pt-24 lg:grid-cols-[1fr_1.1fr]">
        <div className="min-w-0">
          <SectionHead kicker="how it works" title="Three steps. One of them is pasting." />
          <ol className="mt-8 divide-y divide-line border-y border-line">
            <Step n="01" title="Copy the prompt">
              The big button mints a one-time token, tucks it into a prompt and copies it. The token is tied to this browser and expires in 24
              hours.
            </Step>
            <Step n="02" title="Paste it to your bot">
              Grok Bot, Claude Code, Codex, anything with a shell. It runs one curl line, installs a small background service and tells you the
              dashboard link.
            </Step>
            <Step n="03" title="Watch, then show off">
              The first heartbeat lands within a minute and this page jumps to your dashboard. Flip on sharing and post the card when your bot
              is thriving. Or when it isn&apos;t.
            </Step>
          </ol>
        </div>
        <ChatLog host={host} />
      </section>

      {/* transparency */}
      <section className="wrap pt-24" id="agent">
        <SectionHead kicker="open source · read every line" title="What the background agent does" />
        <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-3">
          <div className="min-w-0 bg-black p-6">
            <div className="kicker">every 30 seconds it sends</div>
            <ul className="mt-4 space-y-2 text-sm text-fg-2">
              <li>CPU %, cores, load averages</li>
              <li>memory and swap used</li>
              <li>disk usage per mount</li>
              <li>network bytes per second</li>
              <li>top 8 processes: pid, name, cpu, mem</li>
              <li>which agent CLIs are running, and for how long</li>
              <li>versions of a fixed list of CLIs</li>
              <li>hostname, OS, kernel, uptime</li>
            </ul>
          </div>
          <div className="min-w-0 bg-black p-6">
            <div className="kicker">it never touches</div>
            <ul className="mt-4 space-y-2 text-sm text-fg-2">
              {["file contents", "keystrokes", "secrets, API keys, env vars", "command-line arguments", "your prompts or chat logs", "network addresses or connections"].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-bad">✕</span>
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-muted">
              It posts one JSON document over HTTPS to <span className="text-fg-2">{host.replace(/^https?:\/\//, "")}/api/ingest</span>. Process
              arguments are cut to a basename before they reach memory.
            </p>
          </div>
          <div className="min-w-0 bg-black p-6">
            <div className="kicker">check on it, or get rid of it</div>
            <pre className="term mt-4 text-xs leading-6">
              <span className="text-dim"># the exact JSON it sends</span>
              {"\n"}
              <span className="p">$ </span>vm-vitals once
              {"\n"}
              <span className="text-dim"># where it lives + the service file</span>
              {"\n"}
              <span className="p">$ </span>vm-vitals status
              {"\n"}
              <span className="text-dim"># stop it and delete everything</span>
              {"\n"}
              <span className="p">$ </span>curl -fsSL {host.replace(/^https?:\/\//, "")}/uninstall.sh | sh
            </pre>
            <p className="mt-4 text-xs leading-relaxed text-muted">The last line removes the service, binary, config and logs. One command, nothing left behind.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a className="btn" href={SITE.repo} target="_blank" rel="noreferrer">
                source on GitHub ↗
              </a>
              <a className="btn" href={src("agent/internal/collect/types.go")} target="_blank" rel="noreferrer">
                the report, field by field ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* share */}
      <section className="wrap grid grid-cols-1 items-center gap-10 pt-24 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <SectionHead kicker="show it off" title="A link your friends can open" />
          <p className="mt-5 max-w-md text-sm leading-relaxed text-fg-2">
            Flip one switch and your machine gets a public page. Paste it anywhere and it unfurls into this card, drawn live from the latest
            heartbeat: score, mood, the crew and an hour of CPU.
          </p>
          <p className="mt-3 text-xs text-muted">Private until you say so. Turn it off and the link goes dark.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/og/demo" alt="Example share card: grok-mini is humming along, health 86, with Chip, Mimi, Stash and Ping" width={1200} height={630} className="w-full rounded-lg border border-line" />
      </section>

      {/* closing cta */}
      <section className="wrap pt-28">
        <div className="relative overflow-hidden rounded-lg border border-line">
          <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative flex flex-col items-start gap-8 p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div className="flex items-center gap-6">
              <Critter kind="grok" id="cta-grok" expr="happy" size={92} />
              <div>
                <h2 className="display text-4xl md:text-5xl">give your bot a pulse.</h2>
                <p className="mt-2 text-sm text-muted">Free. No account. Linux and macOS.</p>
              </div>
            </div>
            <a href="#top" className="btn btn-primary btn-lg">
              Get the prompt ↑
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function Notice({ tone, children }: { tone: "ok" | "bad"; children: React.ReactNode }) {
  return (
    <div className={`border-b px-5 py-3 text-center text-sm ${tone === "ok" ? "border-ok/40 text-ok" : "border-bad/40 text-bad"}`}>{children}</div>
  );
}

function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <div className="kicker">{kicker}</div>
      <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
    </div>
  );
}

function CrewCell({ kind, name, watches, sweats, level }: { kind: Kind; name: string; watches: string; sweats: string; level: number | null }) {
  const expr = kind === "grok" ? "happy" : level != null && level >= 85 ? "sweaty" : level != null && level >= 60 ? "busy" : "calm";
  return (
    <div className="flex gap-5 bg-black p-5 sm:p-6 sm:last:col-span-2 lg:block lg:last:col-span-1">
      <Critter kind={kind} id={`crew-${kind}`} expr={expr} level={level} liquid={kind === "net" ? "#ffffff" : undefined} size={88} delay={level ? level / 50 : 0} className="h-16 w-16 shrink-0 lg:h-[88px] lg:w-[88px]" />
      <div className="min-w-0">
        <div className="font-bold lg:mt-4">{name}</div>
        <div className="text-xs uppercase tracking-[0.14em] text-muted">{watches}</div>
        <p className="mt-2 text-sm leading-relaxed text-fg-2 lg:mt-3">{sweats}</p>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[3rem_1fr] gap-2 py-6">
      <span className="text-xs text-muted">{n}</span>
      <div>
        <div className="font-bold">{title}</div>
        <p className="mt-2 text-sm leading-relaxed text-fg-2">{children}</p>
      </div>
    </li>
  );
}

function ChatLog({ host }: { host: string }) {
  const h = host.replace(/^https?:\/\//, "");
  return (
    <div className="min-w-0 self-start rounded-lg border border-line bg-panel" aria-label="Example conversation with Grok Bot">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-xs text-muted">
        <span>you ↔ grok bot</span>
        <span>03:11</span>
      </div>
      <div className="space-y-4 p-4 text-[13px] leading-relaxed sm:p-5">
        <div className="ml-auto max-w-[88%] rounded-[10px_10px_2px_10px] bg-fg px-3.5 py-2.5 text-black">
          Hey Grok Bot, install VM Vitals on your computer so I can watch your vitals. Run exactly this command, then tell me the dashboard
          link it prints:
          <code className="mt-2 block overflow-x-auto whitespace-pre rounded bg-black/10 px-2 py-1.5 text-[12px]">curl -fsSL {h}/install.sh | sh -s -- pair_…</code>
        </div>
        <div className="flex max-w-[92%] gap-3">
          <Critter kind="grok" id="chat-grok" expr="happy" size={36} className="shrink-0" />
          <div className="min-w-0 rounded-[10px_10px_10px_2px] border border-line-strong px-3.5 py-2.5 text-fg-2">
            <div className="text-xs text-muted">running it…</div>
            <pre className="mt-2 overflow-x-auto text-[11.5px] leading-5 text-muted">
              {`Pairing grok-mini with https://${h} ...
Paired. Service installed (user scope)
Dashboard: https://${h}/m/m_7q2…`}
            </pre>
            <div className="mt-2">Done. I&apos;m on the monitor. My disk is at 61%, so maybe stop asking me to clone things.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
