import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { q, one } from "@/lib/db";
import { reconcileOffline } from "@/lib/alerts";
import { OFFLINE_AFTER_MS, type Alert, type Incident, type Machine } from "@/lib/types";
import { ago, appUrl, healthOf, osLabel, HEALTH_LABEL } from "@/lib/format";
import { HealthBadge, SeverityDot } from "@/components/ui";
import { ReportView, AlertsList } from "@/components/ReportView";
import { Charts } from "@/components/Charts";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const m = await one<Machine>(`SELECT * FROM machines WHERE share_slug = $1 AND share_public = true`, [slug]);
  if (!m) return null;
  const offline = await reconcileOffline(m.id, m.last_seen_at, OFFLINE_AFTER_MS);
  const alerts = await q<Alert>(`SELECT * FROM alerts WHERE machine_id = $1 ORDER BY (resolved_at IS NULL) DESC, opened_at DESC LIMIT 20`, [m.id]);
  const incidents = await q<Incident>(`SELECT * FROM incidents WHERE machine_id = $1 ORDER BY started_at DESC LIMIT 30`, [m.id]);
  const open = alerts.filter((a) => !a.resolved_at);
  const health = healthOf({ offline, severities: open.map((a) => a.severity) });
  return { m, offline, alerts, incidents, health };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: "Not found" };
  const r = d.m.last_report;
  const root = r?.disks.find((x) => x.mount === "/") ?? r?.disks[0];
  const desc = r
    ? `${HEALTH_LABEL[d.health]} · CPU ${Math.round(r.cpu.pct)}% · Mem ${Math.round(r.mem.pct)}% · Disk ${root ? Math.round(root.pct) : "?"}% · ${r.jobs.length} agent job${r.jobs.length === 1 ? "" : "s"} running`
    : "Waiting for first report";
  const url = `${appUrl()}/s/${slug}`;
  return {
    title: `${d.m.name} · my AI's computer, live`,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: `${d.m.name}: ${HEALTH_LABEL[d.health]}`, description: desc, url, type: "website" },
    twitter: { card: "summary_large_image", title: `${d.m.name}: ${HEALTH_LABEL[d.health]}`, description: desc },
  };
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const { m, alerts, incidents, health } = d;
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">my AI&apos;s computer, live</div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{m.name}</h1>
            <HealthBadge health={health} big />
          </div>
          <div className="mono mt-1 text-xs text-muted">
            {osLabel(m.os)} {m.arch} · {d.offline ? "last seen" : "reported"} {ago(m.last_seen_at)} · refreshes on reload
          </div>
        </div>
        <Link href="/" className="btn">
          Monitor your own
        </Link>
      </header>

      {m.last_report ? (
        <>
          <Charts machineId={m.id} />
          <ReportView report={m.last_report} />
        </>
      ) : (
        <div className="card p-8 text-center text-sm text-muted">Paired, waiting for the first report.</div>
      )}

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium">Alerts</h2>
        <AlertsList alerts={alerts} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Incidents</h2>
        {incidents.length === 0 ? (
          <div className="card p-5 text-sm text-muted">Nothing logged yet.</div>
        ) : (
          <ol className="space-y-3">
            {incidents.map((inc) => (
              <li key={inc.id} className="card flex gap-3 p-4">
                <SeverityDot severity={inc.severity} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <div className="font-medium">{inc.title}</div>
                    <div className="mono text-xs text-muted">
                      {new Date(inc.started_at).toLocaleDateString()} · {inc.severity} · {inc.resolved_at ? "resolved" : "open"}
                    </div>
                  </div>
                  {inc.what_broke && (
                    <div className="mt-2 text-sm">
                      <span className="text-muted">Broke: </span>
                      <span className="whitespace-pre-wrap text-secondary">{inc.what_broke}</span>
                    </div>
                  )}
                  {inc.what_fixed && (
                    <div className="mt-1 text-sm">
                      <span className="text-muted">Fix: </span>
                      <span className="whitespace-pre-wrap text-secondary">{inc.what_fixed}</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
