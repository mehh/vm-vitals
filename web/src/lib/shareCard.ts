import { q, one } from "./db";
import { OFFLINE_AFTER_MS, type Alert, type Machine } from "./types";
import { bytes, duration, osLabel } from "./format";
import { healthScore, moodFor } from "./vitals";
import { crewFor } from "./crew";
import type { ShareCardData } from "./og";

/** Live data for a public machine's social card, or null if it isn't shared. */
export async function shareCardData(slug: string): Promise<ShareCardData | null> {
  const m = await one<Machine>(`SELECT * FROM machines WHERE share_slug = $1 AND share_public = true`, [slug]);
  if (!m) return null;
  const alerts = await q<Pick<Alert, "severity">>(`SELECT severity FROM alerts WHERE machine_id = $1 AND resolved_at IS NULL`, [m.id]);
  const spark = await q<{ cpu_pct: number | null }>(
    `SELECT avg(cpu_pct)::float8 AS cpu_pct FROM samples WHERE machine_id = $1 AND at > now() - interval '1 hour'
      GROUP BY floor(extract(epoch from at) / 60) ORDER BY floor(extract(epoch from at) / 60)`,
    [m.id],
  );
  const offline = !m.last_seen_at || Date.now() - new Date(m.last_seen_at).getTime() > OFFLINE_AFTER_MS;
  const r = m.last_report;
  const input = { report: r, offline, openSeverities: alerts.map((a) => a.severity) };
  const mood = moodFor(input);
  const jobs = r ? [...new Set(r.jobs.map((j) => j.kind || j.name))] : [];
  const sub = !r
    ? "listening for the first heartbeat"
    : offline
      ? `${osLabel(m.os)} ${m.arch} · no heartbeat lately`
      : jobs.length
        ? `awake: ${jobs.slice(0, 3).join(", ").toLowerCase()}`
        : `${osLabel(m.os)} ${m.arch} · up ${duration(r.uptime_s)} · ${bytes(r.mem.total_b, 0)} ram`;
  return {
    id: m.id,
    name: m.name,
    mood,
    score: r && !offline ? healthScore(input) : null,
    sub,
    crew: crewFor(r, offline),
    cpu: spark.map((s) => s.cpu_pct ?? 0),
    host: "",
  };
}
