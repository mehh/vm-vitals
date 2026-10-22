#!/usr/bin/env node
/**
 * Seeds a demo machine with an hour of believable history so the dashboard,
 * share page and OG image have something to show. Prints the owner cookie,
 * machine id and share slug as JSON (no secrets beyond a throwaway demo token).
 *
 *   node scripts/seed-demo.mjs            # against localhost:3000
 *   BASE=https://x.vercel.app node scripts/seed-demo.mjs
 */
const BASE = process.env.BASE ?? "http://localhost:3000";
const NAME = process.env.NAME ?? "grok-mini";
let cookie = "";

async function call(path, init = {}, withCookie = true) {
  const headers = { ...(init.headers ?? {}) };
  if (withCookie && cookie) headers.cookie = cookie;
  const r = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  for (const c of r.headers.getSetCookie?.() ?? []) {
    const kv = c.split(";")[0];
    const [k] = kv.split("=");
    cookie = cookie.split("; ").filter((x) => x && !x.startsWith(k + "=")).concat(kv).join("; ");
  }
  return r;
}

const wave = (t, base, amp, period, phase = 0) => base + amp * Math.sin((t / period) * 2 * Math.PI + phase);

function report(at, i, n) {
  const t = i / n; // 0..1 across the hour
  const cpu = Math.max(2, Math.min(99, wave(i, 38, 22, 17) + wave(i, 0, 9, 5, 1) + (t > 0.7 && t < 0.8 ? 35 : 0)));
  const memPct = Math.min(96, 52 + t * 14 + wave(i, 0, 3, 11));
  const diskPct = 71 + t * 2.5;
  const rx = Math.max(0, wave(i, 180e3, 120e3, 13) + (i % 9 === 0 ? 1.4e6 : 0));
  const tx = Math.max(0, wave(i, 60e3, 40e3, 7, 2));
  const jobs = [
    { name: "grok", kind: "Grok Bot", pid: 7311, cpu_pct: Math.round(cpu * 0.6), rss_b: 1.9e9, elapsed_s: 23 * 3600 + i * 30 },
    ...(t > 0.3 ? [{ name: "claude", kind: "Claude Code", pid: 8120, cpu_pct: Math.round(cpu * 0.3), rss_b: 7.2e8, elapsed_s: Math.round((t - 0.3) * 3600) }] : []),
  ];
  return {
    v: 1, at: at.toISOString(), hostname: "grok-mini.local", os: "darwin", arch: "arm64", kernel: "macOS 26.0", uptime_s: 19 * 86400 + 4000 + i * 30, agent_version: "v0.2.0",
    cpu: { pct: Math.round(cpu * 10) / 10, cores: 10 },
    load: { l1: Math.round(cpu / 10 * 10) / 10, l5: Math.round(cpu / 12 * 10) / 10, l15: 2.1 },
    mem: { total_b: 32e9, used_b: Math.round(32e9 * memPct / 100), avail_b: Math.round(32e9 * (1 - memPct / 100)), pct: Math.round(memPct * 10) / 10 },
    swap: { total_b: 4e9, used_b: Math.round(4e9 * 0.18), pct: 18 },
    disks: [
      { mount: "/", fs: "apfs", total_b: 994e9, used_b: Math.round(994e9 * diskPct / 100), pct: Math.round(diskPct * 10) / 10 },
      { mount: "/Volumes/Scratch", fs: "apfs", total_b: 2e12, used_b: 0.42e12, pct: 21 },
    ],
    top_procs: [
      { pid: 7311, name: "grok", cpu_pct: Math.round(cpu * 0.6), mem_pct: 5.9, rss_b: 1.9e9 },
      { pid: 8120, name: "node", cpu_pct: Math.round(cpu * 0.3), mem_pct: 2.3, rss_b: 7.2e8 },
      { pid: 912, name: "ollama", cpu_pct: 4, mem_pct: 12.1, rss_b: 3.9e9 },
      { pid: 455, name: "tailscaled", cpu_pct: 0.4, mem_pct: 0.2, rss_b: 6e7 },
      { pid: 1, name: "launchd", cpu_pct: 0.1, mem_pct: 0.1, rss_b: 2e7 },
      { pid: 2210, name: "WindowServer", cpu_pct: 1.2, mem_pct: 0.9, rss_b: 3e8 },
    ],
    oom: { supported: false, kills_total: 0 },
    tools: [
      { name: "grok", path: "/opt/homebrew/bin/grok", version: "1.4.2" },
      { name: "claude", path: "/opt/homebrew/bin/claude", version: "2.1.300 (Claude Code)" },
      { name: "codex", path: "/opt/homebrew/bin/codex", version: "0.52.0" },
      { name: "node", path: "/opt/homebrew/bin/node", version: "v24.4.0" },
      { name: "python3", path: "/usr/bin/python3", version: "Python 3.12.4" },
      { name: "ollama", path: "/opt/homebrew/bin/ollama", version: "0.6.1" },
      { name: "tailscale", path: "/usr/local/bin/tailscale", version: "1.80.2" },
      { name: "docker", path: "/usr/local/bin/docker", version: "28.1.1" },
    ],
    jobs,
    net: { rx_bps: Math.round(rx), tx_bps: Math.round(tx), rx_total_b: 11.5e9 + i * 5e6, tx_total_b: 1.7e9 + i * 1.8e6 },
  };
}

async function main() {
  let r = await call("/api/pair-tokens", { method: "POST" });
  const minted = await r.json();
  r = await call("/api/pair", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pair_token: minted.token, hostname: "grok-mini.local", os: "darwin", arch: "arm64", agent_version: "v0.2.0" }) }, false);
  const paired = await r.json();
  const n = 120;
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const at = new Date(now - (n - 1 - i) * 30_000);
    r = await call("/api/ingest", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${paired.machine_token}` }, body: JSON.stringify(report(at, i, n)) }, false);
    if (!r.ok) throw new Error(`ingest ${i} failed: ${r.status}`);
  }
  await call(`/api/machines/${paired.machine_id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ share_public: true, name: NAME }) });
  await call(`/api/machines/${paired.machine_id}/incidents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Disk hit 90%, Grok stopped answering", what_broke: "pnpm store and ~/Library/Caches/ollama filled the SSD overnight", what_fixed: "pnpm store prune; moved ollama models to /Volumes/Scratch", severity: "major", resolved: true }) });
  await call(`/api/machines/${paired.machine_id}/incidents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Claude Code job died mid-refactor", what_broke: "launchd restarted after a macOS update; the session was gone", severity: "minor" }) });
  r = await call(`/api/machines/${paired.machine_id}`);
  const snap = await r.json();
  console.log(JSON.stringify({ base: BASE, machine_id: paired.machine_id, share_slug: snap.machine.share_slug, cookie, dashboard: `${BASE}/m/${paired.machine_id}`, share: `${BASE}/s/${snap.machine.share_slug}` }));
}
main().catch((e) => { console.error(e); process.exit(1); });
