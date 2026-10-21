import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { sha256 } from "@/lib/ids";
import { evaluateAlerts } from "@/lib/alerts";
import type { Report } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY = 256 * 1024;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 401 });
  const m = await one<{ id: string; last_report: Report | null }>(
    `SELECT id, last_report FROM machines WHERE token_hash = $1`,
    [sha256(token)],
  );
  if (!m) return NextResponse.json({ error: "unknown machine token" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "report too large" }, { status: 413 });
  let report: Report;
  try {
    report = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!report || report.v !== 1 || !report.cpu || !report.mem || !Array.isArray(report.disks)) {
    return NextResponse.json({ error: "malformed report" }, { status: 400 });
  }

  report = sanitize(report);
  const at = new Date(report.at ?? Date.now());
  const safeAt = isNaN(at.getTime()) ? new Date() : at;
  const rootDisk = report.disks.find((d) => d.mount === "/") ?? report.disks[0];

  await q(
    `INSERT INTO samples (machine_id, at, cpu_pct, mem_pct, disk_pct, swap_pct, load1, mem_used_b, disk_used_b, oom_kills, jobs)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      m.id,
      safeAt,
      report.cpu.pct,
      report.mem.pct,
      rootDisk?.pct ?? null,
      report.swap.pct,
      report.load.l1,
      report.mem.used_b,
      rootDisk?.used_b ?? null,
      report.oom?.kills_total ?? 0,
      report.jobs.length,
    ],
  );
  await q(
    `UPDATE machines SET last_seen_at = now(), last_report = $2, agent_version = $3,
            hostname = COALESCE($4, hostname), os = COALESCE($5, os), arch = COALESCE($6, arch)
      WHERE id = $1`,
    [m.id, JSON.stringify(report), report.agent_version ?? null, report.hostname ?? null, report.os ?? null, report.arch ?? null],
  );

  const opened = await evaluateAlerts(m.id, m.last_report, report);
  // Resolve a lingering offline alert now that we heard from it.
  await q(`UPDATE alerts SET resolved_at = now() WHERE machine_id = $1 AND kind = 'offline' AND resolved_at IS NULL`, [m.id]);

  // Light retention: keep 7 days of samples. Run ~1 in 50 ingests.
  if (Math.random() < 0.02) {
    await q(`DELETE FROM samples WHERE machine_id = $1 AND at < now() - interval '7 days'`, [m.id]);
  }

  return NextResponse.json({ ok: true, interval_s: 30, alerts_opened: opened.length });
}

/** Clamp list sizes and string lengths; the agent is trusted-ish, the network isn't. */
function sanitize(r: Report): Report {
  const str = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");
  const num = (x: unknown) => (typeof x === "number" && isFinite(x) ? x : 0);
  return {
    v: 1,
    at: str(r.at, 40),
    hostname: str(r.hostname, 120),
    os: str(r.os, 20),
    arch: str(r.arch, 20),
    kernel: str(r.kernel, 80),
    uptime_s: num(r.uptime_s),
    agent_version: str(r.agent_version, 40),
    cpu: { pct: num(r.cpu?.pct), cores: num(r.cpu?.cores) },
    load: { l1: num(r.load?.l1), l5: num(r.load?.l5), l15: num(r.load?.l15) },
    mem: { total_b: num(r.mem?.total_b), used_b: num(r.mem?.used_b), avail_b: num(r.mem?.avail_b), pct: num(r.mem?.pct) },
    swap: { total_b: num(r.swap?.total_b), used_b: num(r.swap?.used_b), pct: num(r.swap?.pct) },
    disks: (r.disks ?? []).slice(0, 16).map((d) => ({
      mount: str(d.mount, 120),
      fs: str(d.fs, 20),
      total_b: num(d.total_b),
      used_b: num(d.used_b),
      pct: num(d.pct),
    })),
    top_procs: (r.top_procs ?? []).slice(0, 12).map((p) => ({
      pid: num(p.pid),
      name: str(p.name, 60),
      cpu_pct: num(p.cpu_pct),
      mem_pct: num(p.mem_pct),
      rss_b: num(p.rss_b),
    })),
    oom: {
      supported: !!r.oom?.supported,
      kills_total: num(r.oom?.kills_total),
      recent: (r.oom?.recent ?? []).slice(0, 5).map((s) => str(s, 120)),
    },
    tools: (r.tools ?? []).slice(0, 48).map((t) => ({ name: str(t.name, 40), path: str(t.path, 200), version: str(t.version, 80) })),
    jobs: (r.jobs ?? []).slice(0, 32).map((j) => ({
      name: str(j.name, 40),
      kind: str(j.kind, 40),
      pid: num(j.pid),
      cpu_pct: num(j.cpu_pct),
      rss_b: num(j.rss_b),
      elapsed_s: num(j.elapsed_s),
    })),
    warnings: (r.warnings ?? []).slice(0, 10).map((w) => str(w, 200)),
  };
}
