/** Mirror of agent/internal/collect/types.go. Keep in sync. */
export interface Report {
  v: number;
  at: string;
  hostname: string;
  os: string;
  arch: string;
  kernel?: string;
  uptime_s: number;
  agent_version: string;
  cpu: { pct: number; cores: number };
  load: { l1: number; l5: number; l15: number };
  mem: { total_b: number; used_b: number; avail_b: number; pct: number };
  swap: { total_b: number; used_b: number; pct: number };
  disks: { mount: string; fs?: string; total_b: number; used_b: number; pct: number }[];
  top_procs: { pid: number; name: string; cpu_pct: number; mem_pct: number; rss_b: number }[];
  oom: { supported: boolean; kills_total: number; recent?: string[] };
  tools: { name: string; path: string; version?: string }[];
  jobs: { name: string; kind: string; pid: number; cpu_pct: number; rss_b: number; elapsed_s: number }[];
  warnings?: string[];
}

export interface Machine {
  id: string;
  name: string;
  hostname: string | null;
  os: string | null;
  arch: string | null;
  owner_key: string;
  owner_email: string | null;
  share_slug: string | null;
  share_public: boolean;
  created_at: Date;
  last_seen_at: Date | null;
  last_report: Report | null;
  agent_version: string | null;
}

export interface Alert {
  id: string | number;
  machine_id: string;
  kind: string;
  severity: "info" | "warning" | "critical";
  message: string;
  dedupe_key: string;
  opened_at: Date;
  resolved_at: Date | null;
}

export interface Incident {
  id: string;
  machine_id: string;
  title: string;
  what_broke: string | null;
  what_fixed: string | null;
  severity: "minor" | "major" | "outage";
  started_at: Date;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Sample {
  at: string;
  cpu_pct: number | null;
  mem_pct: number | null;
  disk_pct: number | null;
  swap_pct: number | null;
  load1: number | null;
  oom_kills: number | null;
  jobs: number | null;
}

/** Offline threshold: no report for this long means the machine is down. */
export const OFFLINE_AFTER_MS = 2 * 60 * 1000;
