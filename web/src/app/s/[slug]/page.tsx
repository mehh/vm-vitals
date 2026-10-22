import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { q, one } from "@/lib/db";
import { reconcileOffline } from "@/lib/alerts";
import { OFFLINE_AFTER_MS, type Alert, type Incident, type Machine } from "@/lib/types";
import { ago, appUrl, healthOf, osLabel } from "@/lib/format";
import { healthScore, moodFor, rootDisk } from "@/lib/vitals";
import { HealthBadge, SeverityDot } from "@/components/ui";
import { ReportView } from "@/components/ReportView";
import { Charts } from "@/components/Charts";
import { MachineHero } from "@/components/MachineHero";
import { CrewBoard } from "@/components/CrewBoard";
import { Critter } from "@/components/Critters";
import { ShareButtons } from "@/components/ShareButtons";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const m = await one<Machine>(`SELECT * FROM machines WHERE share_slug = $1 AND share_public = true`, [slug]);
  if (!m) return null;
  const offline = await reconcileOffline(m.id, m.last_seen_at, OFFLINE_AFTER_MS);
  const alerts = await q<Alert>(`SELECT * FROM alerts WHERE machine_id = $1 ORDER BY (resolved_at IS NULL) DESC, opened_at DESC LIMIT 20`, [m.id]);
  const incidents = await q<Incident>(`SELECT * FROM incidents WHERE machine_id = $1 ORDER BY started_at DESC LIMIT 30`, [m.id]);
  const open = alerts.filter((a) => !a.resolved_at).map((a) => a.severity);
  const health = healthOf({ offline, severities: open });
  const input = { report: m.last_report, offline, openSeverities: open };
  return { m, offline, alerts, incidents, health, open, score: healthScore(input), mood: moodFor(input) };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: "Not found" };
  const r = d.m.last_report;
  const root = rootDisk(r);
  const desc = r
    ? `${d.mood.label}, health ${d.score}/100. CPU ${Math.round(r.cpu.pct)}%, memory ${Math.round(r.mem.pct)}%, disk ${root ? Math.round(root.pct) : "?"}%, ${r.jobs.length} agent job${r.jobs.length === 1 ? "" : "s"} awake. Live from VM Vitals.`
    : "Paired and listening for the first heartbeat. Live from VM Vitals.";
  const url = `${appUrl()}/s/${slug}`;
  const title = `${d.m.name} is ${d.mood.label.toLowerCase()} · my AI's computer, live`;
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, url, type: "website" },
    twitter: { card: "summary_large_image", title, description: desc },
  };
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const { m, alerts, incidents, health, open } = d;
  return (
    <div>
      <MachineHero
        id={m.id}
        name={m.name}
        kicker="my AI's computer, live"
        meta={
          <>
            {osLabel(m.os)} {m.arch} · {d.offline ? "last seen" : "heartbeat"} {ago(m.last_seen_at)} · the crew updates live
          </>
        }
        report={m.last_report}
        offline={d.offline}
        openSeverities={open}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <HealthBadge health={health} big />
            <ShareButtons url={`${appUrl()}/s/${slug}`} title={`${m.name} · VM Vitals`} />
          </div>
        }
      />

      <div className="wrap space-y-16 pt-10">
        {m.last_report ? (
          <CrewBoard machineId={m.id} report={m.last_report} offline={d.offline} />
        ) : (
          <div className="rounded-lg border border-dashed border-line-strong p-10 text-center text-sm text-muted">Paired. Listening for the first heartbeat.</div>
        )}

        {m.last_report && (
          <>
            <Charts machineId={m.id} />
            <section className="space-y-4">
              <div>
                <div className="kicker">right now</div>
                <h2 className="mt-2 text-xl font-bold tracking-tight">What the box is up to</h2>
              </div>
              <ReportView report={m.last_report} alerts={alerts} />
            </section>
          </>
        )}

        <section className="space-y-4">
          <div>
            <div className="kicker">incidents</div>
            <h2 className="mt-2 text-xl font-bold tracking-tight">What broke, what fixed it</h2>
          </div>
          {incidents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">Nothing logged. Either nothing has broken yet, or nobody wrote it down.</div>
          ) : (
            <ol className="divide-y divide-line border-y border-line">
              {incidents.map((inc) => (
                <li key={inc.id} className="flex gap-3 py-4">
                  <SeverityDot severity={inc.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <div className="font-bold">{inc.title}</div>
                      <div className="text-xs text-muted">
                        {new Date(inc.started_at).toLocaleDateString()} · {inc.severity} · {inc.resolved_at ? "resolved" : "open"}
                      </div>
                    </div>
                    {inc.what_broke && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted">broke: </span>
                        <span className="whitespace-pre-wrap text-fg-2">{inc.what_broke}</span>
                      </div>
                    )}
                    {inc.what_fixed && (
                      <div className="mt-1 text-sm">
                        <span className="text-muted">fix: </span>
                        <span className="whitespace-pre-wrap text-fg-2">{inc.what_fixed}</span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="relative overflow-hidden rounded-lg border border-line">
          <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <Critter kind="grok" id="share-cta" expr="curious" size={80} />
              <div>
                <div className="text-2xl font-bold tracking-tight">Got a bot of your own?</div>
                <div className="mt-1 text-sm text-muted">Paste one prompt into it. A minute later you have a page like this.</div>
              </div>
            </div>
            <Link href="/" className="btn btn-primary btn-lg">
              Get a prompt for your Grok Bot
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
