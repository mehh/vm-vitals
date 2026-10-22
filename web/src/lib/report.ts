/**
 * Lenient parsing of an agent report. The agent is ours, but it ships on
 * machines we never see: older builds, odd kernels, containers whose root is
 * an overlay. A Go nil slice marshals as JSON null, so "disks": null is a
 * real payload we have received. Missing, null or wrong-typed fields become
 * zero values; unknown fields are dropped. Only a body that isn't an object
 * is rejected.
 */
import type { Report } from "./types";

type Obj = Record<string, unknown>;

const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");
const num = (x: unknown) => {
  if (typeof x === "number") return isFinite(x) ? x : 0;
  if (typeof x === "string" && x.trim() !== "") {
    const n = Number(x);
    return isFinite(n) ? n : 0;
  }
  return 0;
};
const obj = (x: unknown): Obj => (isObj(x) ? x : {});
/** Array of objects, capped at n. Null, undefined, and non-arrays become []. */
const objs = (x: unknown, n: number): Obj[] => (Array.isArray(x) ? x.filter(isObj).slice(0, n) : []);
const strs = (x: unknown, n: number, len: number): string[] =>
  Array.isArray(x) ? x.filter((s) => typeof s === "string").slice(0, n).map((s) => str(s, len)) : [];

/** Returns null only when the body is not a JSON object. */
export function parseReport(raw: unknown): Report | null {
  if (!isObj(raw)) return null;
  const r = raw;
  const v = r.v === undefined || r.v === null ? 1 : num(r.v);
  if (v < 1) return null;

  const cpu = obj(r.cpu);
  const load = obj(r.load);
  const mem = obj(r.mem);
  const swap = obj(r.swap);
  const oom = obj(r.oom);
  const net = isObj(r.net) ? r.net : null;

  return {
    v: 1,
    at: str(r.at, 40),
    hostname: str(r.hostname, 120),
    os: str(r.os, 20),
    arch: str(r.arch, 20),
    kernel: str(r.kernel, 80),
    uptime_s: num(r.uptime_s),
    agent_version: str(r.agent_version, 40),
    cpu: { pct: num(cpu.pct), cores: num(cpu.cores) },
    load: { l1: num(load.l1), l5: num(load.l5), l15: num(load.l15) },
    mem: { total_b: num(mem.total_b), used_b: num(mem.used_b), avail_b: num(mem.avail_b), pct: num(mem.pct) },
    swap: { total_b: num(swap.total_b), used_b: num(swap.used_b), pct: num(swap.pct) },
    disks: objs(r.disks, 16).map((d) => ({
      mount: str(d.mount, 120),
      fs: str(d.fs, 20),
      total_b: num(d.total_b),
      used_b: num(d.used_b),
      pct: num(d.pct),
    })),
    top_procs: objs(r.top_procs, 12).map((p) => ({
      pid: num(p.pid),
      name: str(p.name, 60),
      cpu_pct: num(p.cpu_pct),
      mem_pct: num(p.mem_pct),
      rss_b: num(p.rss_b),
    })),
    oom: {
      supported: !!oom.supported,
      kills_total: num(oom.kills_total),
      recent: strs(oom.recent, 5, 120),
    },
    tools: objs(r.tools, 48).map((t) => ({ name: str(t.name, 40), path: str(t.path, 200), version: str(t.version, 80) })),
    jobs: objs(r.jobs, 32).map((j) => ({
      name: str(j.name, 40),
      kind: str(j.kind, 40),
      pid: num(j.pid),
      cpu_pct: num(j.cpu_pct),
      rss_b: num(j.rss_b),
      elapsed_s: num(j.elapsed_s),
    })),
    ...(net ? { net: { rx_bps: num(net.rx_bps), tx_bps: num(net.tx_bps), rx_total_b: num(net.rx_total_b), tx_total_b: num(net.tx_total_b) } } : {}),
    warnings: strs(r.warnings, 10, 200),
  };
}
