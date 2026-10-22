import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { sha256 } from "@/lib/ids";
import { evaluateAlerts } from "@/lib/alerts";
import { parseReport } from "@/lib/report";
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
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  // Lenient on purpose: null lists, missing optionals and unknown fields are
  // all fine. Only a non-object body is malformed.
  const report = parseReport(body);
  if (!report) {
    return NextResponse.json({ error: "malformed report" }, { status: 400 });
  }

  const at = new Date(report.at ?? Date.now());
  const safeAt = isNaN(at.getTime()) ? new Date() : at;
  const rootDisk = report.disks.find((d) => d.mount === "/") ?? report.disks[0];

  await q(
    `INSERT INTO samples (machine_id, at, cpu_pct, mem_pct, disk_pct, swap_pct, load1, mem_used_b, disk_used_b, oom_kills, jobs, net_rx_bps, net_tx_bps)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
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
      report.net?.rx_bps ?? null,
      report.net?.tx_bps ?? null,
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
