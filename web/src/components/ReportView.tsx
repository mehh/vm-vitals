import type { Alert, Report } from "@/lib/types";
import { bytes, duration } from "@/lib/format";
import { Meter, SeverityDot, StatTile } from "./ui";

/** Server-safe view of the latest report. Used by the dashboard and share page. */
export function ReportView({ report, compact = false }: { report: Report; compact?: boolean }) {
  const r = report;
  const root = r.disks.find((d) => d.mount === "/") ?? r.disks[0];
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="CPU" value={`${Math.round(r.cpu.pct)}%`} sub={`${r.cpu.cores} cores · load ${r.load.l1.toFixed(2)} / ${r.load.l5.toFixed(2)} / ${r.load.l15.toFixed(2)}`} pct={r.cpu.pct} color="var(--series-1)" />
        <StatTile label="Memory" value={`${Math.round(r.mem.pct)}%`} sub={`${bytes(r.mem.used_b)} of ${bytes(r.mem.total_b)}`} pct={r.mem.pct} color="var(--series-2)" />
        <StatTile label={`Disk ${root?.mount ?? ""}`} value={root ? `${Math.round(root.pct)}%` : "–"} sub={root ? `${bytes(root.used_b)} of ${bytes(root.total_b)} · ${bytes(root.total_b - root.used_b)} free` : "no disks"} pct={root?.pct} color="var(--series-3)" />
        <StatTile label="Swap" value={r.swap.total_b ? `${Math.round(r.swap.pct)}%` : "none"} sub={r.swap.total_b ? `${bytes(r.swap.used_b)} of ${bytes(r.swap.total_b)}` : "no swap configured"} pct={r.swap.total_b ? r.swap.pct : undefined} color="var(--series-4)" />
      </div>

      <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-2"}`}>
        <Card title="Agent jobs running" badge={String(r.jobs.length)}>
          {r.jobs.length === 0 ? (
            <Empty>No claude / codex / grok / aider processes right now.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {r.jobs.map((j) => (
                <li key={j.pid} className="flex items-center gap-3 py-2 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-good pulse" />
                  <span className="font-medium">{j.kind || j.name}</span>
                  <span className="mono text-xs text-muted">pid {j.pid}</span>
                  <span className="mono ml-auto text-xs text-secondary">
                    {duration(j.elapsed_s)} · {j.cpu_pct}% cpu · {bytes(j.rss_b, 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Top processes">
          <ul className="divide-y divide-border">
            {r.top_procs.slice(0, 8).map((p) => (
              <li key={p.pid} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="mono w-14 shrink-0 text-xs text-muted">{p.pid}</span>
                <span className="truncate">{p.name}</span>
                <span className="mono ml-auto shrink-0 text-xs text-secondary">
                  {p.cpu_pct}% · {bytes(p.rss_b, 0)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Disks">
          <ul className="space-y-3">
            {r.disks.map((d) => (
              <li key={d.mount} className="text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="mono">{d.mount}</span>
                  <span className="mono text-xs text-secondary">
                    {bytes(d.used_b, 0)} / {bytes(d.total_b, 0)} · {Math.round(d.pct)}%
                  </span>
                </div>
                <div className="mt-1.5">
                  <Meter pct={d.pct} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="OOM kills" badge={r.oom.supported ? String(r.oom.kills_total) : "n/a"}>
          {!r.oom.supported ? (
            <Empty>Not available on {r.os === "darwin" ? "macOS" : r.os}. Linux reports the kernel counter.</Empty>
          ) : r.oom.kills_total === 0 ? (
            <Empty>Zero since boot. The kernel hasn&apos;t had to kill anything.</Empty>
          ) : (
            <ul className="mono space-y-1 text-xs text-secondary">
              {(r.oom.recent ?? []).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
              {(!r.oom.recent || r.oom.recent.length === 0) && <li>{r.oom.kills_total} kills since boot (details need journal access)</li>}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Installed tools" badge={String(r.tools.length)}>
        <ul className="flex flex-wrap gap-2">
          {r.tools.map((t) => (
            <li key={t.name} className="mono rounded-md border border-border bg-bg px-2 py-1 text-xs" title={t.path}>
              <span className="text-primary">{t.name}</span>
              {t.version && <span className="text-muted"> {shortVersion(t.name, t.version)}</span>}
            </li>
          ))}
        </ul>
      </Card>

      <div className="mono text-xs text-muted">
        {r.hostname} · {r.kernel} · {r.arch} · up {duration(r.uptime_s)} · agent {r.agent_version}
        {r.warnings?.length ? ` · ${r.warnings.length} collector warning(s)` : ""}
      </div>
    </div>
  );
}

export function AlertsList({ alerts, onlyOpen = false }: { alerts: Alert[]; onlyOpen?: boolean }) {
  const list = onlyOpen ? alerts.filter((a) => !a.resolved_at) : alerts;
  if (list.length === 0) return <Empty>No alerts. Disk under 85%, no OOM kills, no dead jobs.</Empty>;
  return (
    <ul className="divide-y divide-border">
      {list.map((a) => (
        <li key={String(a.id)} className={`flex gap-3 py-2 text-sm ${a.resolved_at ? "opacity-50" : ""}`}>
          <SeverityDot severity={a.severity} />
          <div className="min-w-0 flex-1">
            <div>{a.message}</div>
            <div className="mono text-xs text-muted">
              {a.kind} · {new Date(a.opened_at).toLocaleString()}
              {a.resolved_at ? ` · resolved` : ""}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {badge && <span className="mono rounded-full bg-surface-2 px-2 py-0.5 text-xs text-secondary">{badge}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function shortVersion(name: string, v: string) {
  // "2.1.300 (Claude Code)" -> "2.1.300"; "go version go1.26.1 darwin/arm64" -> "go1.26.1"
  const m = v.match(/v?\d+\.\d+(\.\d+)?[\w.-]*/);
  return m ? m[0] : v.replace(name, "").trim().slice(0, 24);
}
