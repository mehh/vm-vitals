import "server-only";
import { q } from "./db";
import type { Alert, Report } from "./types";

type Severity = Alert["severity"];
interface Desired {
  key: string;
  kind: string;
  severity: Severity;
  message: string;
}

/**
 * Compare a fresh report against the previous one and reconcile the open
 * alerts for this machine: open what's newly wrong, resolve what's fixed.
 * Returns the alerts that were newly opened.
 */
export async function evaluateAlerts(machineId: string, prev: Report | null, cur: Report): Promise<Alert[]> {
  const want: Desired[] = [];

  for (const d of cur.disks) {
    if (d.pct >= 95) {
      want.push({ key: `disk:${d.mount}`, kind: "disk", severity: "critical", message: `Disk ${d.mount} is ${d.pct}% full` });
    } else if (d.pct >= 85) {
      want.push({ key: `disk:${d.mount}`, kind: "disk", severity: "warning", message: `Disk ${d.mount} is ${d.pct}% full` });
    }
  }

  if (cur.mem.pct >= 95) {
    want.push({ key: "mem", kind: "memory", severity: "critical", message: `Memory at ${cur.mem.pct}%` });
  } else if (cur.mem.pct >= 90) {
    want.push({ key: "mem", kind: "memory", severity: "warning", message: `Memory at ${cur.mem.pct}%` });
  }

  if (cur.swap.total_b > 0 && cur.swap.pct >= 80) {
    want.push({ key: "swap", kind: "swap", severity: "warning", message: `Swap at ${cur.swap.pct}%` });
  }

  if (cur.cpu.cores > 0 && cur.load.l5 > cur.cpu.cores * 2) {
    want.push({
      key: "load",
      kind: "load",
      severity: "warning",
      message: `Load ${cur.load.l5.toFixed(1)} on ${cur.cpu.cores} cores (5m avg)`,
    });
  }

  // OOM kills are events, not states: open a fresh alert each time the
  // counter moves, and leave it open until the user clears it (or 1h passes).
  const oomEvents: Desired[] = [];
  if (prev && cur.oom.supported && cur.oom.kills_total > (prev.oom?.kills_total ?? 0)) {
    const n = cur.oom.kills_total - (prev.oom?.kills_total ?? 0);
    const who = cur.oom.recent?.slice(-n).join(", ");
    oomEvents.push({
      key: `oom:${cur.oom.kills_total}`,
      kind: "oom",
      severity: "critical",
      message: `OOM killer fired ${n === 1 ? "once" : n + " times"}${who ? ": " + who : ""}`,
    });
  }

  // Job died: an agent process seen last tick is gone now. Matched by PID.
  const jobEvents: Desired[] = [];
  if (prev) {
    const nowPids = new Set(cur.jobs.map((j) => j.pid));
    for (const j of prev.jobs ?? []) {
      if (!nowPids.has(j.pid) && j.elapsed_s >= 60) {
        jobEvents.push({
          key: `job:${j.pid}`,
          kind: "job_died",
          severity: "info",
          message: `${j.kind} (pid ${j.pid}) exited after ${humanDuration(j.elapsed_s)}`,
        });
      }
    }
  }

  const open = await q<Alert>(`SELECT * FROM alerts WHERE machine_id = $1 AND resolved_at IS NULL`, [machineId]);
  const openByKey = new Map(open.map((a) => [a.dedupe_key, a]));
  const opened: Alert[] = [];

  // State alerts: reconcile.
  const stateKeys = new Set(want.map((w) => w.key));
  for (const w of want) {
    const existing = openByKey.get(w.key);
    if (!existing) {
      opened.push(await insertAlert(machineId, w));
    } else if (existing.severity !== w.severity || existing.message !== w.message) {
      await q(`UPDATE alerts SET severity = $2, message = $3 WHERE id = $1`, [existing.id, w.severity, w.message]);
    }
  }
  for (const a of open) {
    const isState = ["disk", "memory", "swap", "load", "offline"].includes(a.kind);
    if (isState && !stateKeys.has(a.dedupe_key)) {
      await q(`UPDATE alerts SET resolved_at = now() WHERE id = $1`, [a.id]);
    }
  }
  // Event alerts: insert if not already present; auto-resolve after an hour.
  for (const e of [...oomEvents, ...jobEvents]) {
    if (!openByKey.has(e.key)) opened.push(await insertAlert(machineId, e));
  }
  await q(
    `UPDATE alerts SET resolved_at = now()
      WHERE machine_id = $1 AND resolved_at IS NULL AND kind IN ('oom','job_died')
        AND opened_at < now() - interval '1 hour'`,
    [machineId],
  );
  return opened;
}

async function insertAlert(machineId: string, d: Desired): Promise<Alert> {
  const rows = await q<Alert>(
    `INSERT INTO alerts (machine_id, kind, severity, message, dedupe_key)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [machineId, d.kind, d.severity, d.message, d.key],
  );
  return rows[0];
}

/** Called on read: flips the offline alert based on last_seen_at. */
export async function reconcileOffline(machineId: string, lastSeen: Date | null, offlineAfterMs: number) {
  const isOffline = !lastSeen || Date.now() - lastSeen.getTime() > offlineAfterMs;
  const open = await q<Alert>(
    `SELECT * FROM alerts WHERE machine_id = $1 AND resolved_at IS NULL AND kind = 'offline'`,
    [machineId],
  );
  if (isOffline && open.length === 0 && lastSeen) {
    await insertAlert(machineId, {
      key: "offline",
      kind: "offline",
      severity: "critical",
      message: `No report since ${lastSeen.toISOString().replace("T", " ").slice(0, 16)} UTC`,
    });
  } else if (!isOffline && open.length > 0) {
    await q(`UPDATE alerts SET resolved_at = now() WHERE machine_id = $1 AND kind = 'offline' AND resolved_at IS NULL`, [machineId]);
  }
  return isOffline;
}

export function humanDuration(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}
