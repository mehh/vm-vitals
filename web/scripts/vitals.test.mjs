import { test } from "node:test";
import assert from "node:assert/strict";
import { healthScore, moodFor, heartbeatBpm, bps, scoreColor } from "../src/lib/vitals.ts";

function report(o = {}) {
  return {
    v: 1, at: new Date().toISOString(), hostname: "t", os: "linux", arch: "amd64", uptime_s: 10, agent_version: "t",
    cpu: { pct: 12, cores: 4 }, load: { l1: 0.4, l5: 0.5, l15: 0.5 },
    mem: { total_b: 8e9, used_b: 3e9, avail_b: 5e9, pct: 37 }, swap: { total_b: 0, used_b: 0, pct: 0 },
    disks: [{ mount: "/", total_b: 100e9, used_b: 40e9, pct: 40 }], top_procs: [], oom: { supported: true, kills_total: 0 }, tools: [], jobs: [],
    ...o,
  };
}

test("an idle, roomy box is thriving", () => {
  const input = { report: report(), offline: false, openSeverities: [] };
  assert.equal(healthScore(input), 100);
  assert.equal(moodFor(input).key, "thriving");
});

test("a nearly full disk with a critical alert is flatlining-ish", () => {
  const input = { report: report({ disks: [{ mount: "/", total_b: 1, used_b: 1, pct: 97 }], mem: { total_b: 1, used_b: 1, avail_b: 0, pct: 93 } }), offline: false, openSeverities: ["critical", "warning"] };
  const s = healthScore(input);
  assert.ok(s < 40, `score ${s}`);
  assert.ok(["wheezing", "flatlining"].includes(moodFor(input).key));
});

test("high cpu alone barely dents the score (bots are supposed to work)", () => {
  const s = healthScore({ report: report({ cpu: { pct: 100, cores: 4 } }), offline: false, openSeverities: [] });
  assert.ok(s >= 88, `score ${s}`);
});

test("offline is ghosted with no score; no report is waiting", () => {
  assert.equal(moodFor({ report: report(), offline: true, openSeverities: [] }).key, "ghosted");
  assert.equal(healthScore({ report: report(), offline: true, openSeverities: [] }), 0);
  assert.equal(moodFor({ report: null, offline: false, openSeverities: [] }).key, "waiting");
});

test("alert penalty is capped so one noisy box does not hit zero", () => {
  const s = healthScore({ report: report(), offline: false, openSeverities: Array(20).fill("critical") });
  assert.equal(s, 70);
});

test("heartbeat races with cpu and load, within limits", () => {
  assert.equal(heartbeatBpm(null), 0);
  const idle = heartbeatBpm(report());
  const hot = heartbeatBpm(report({ cpu: { pct: 100, cores: 4 }, load: { l1: 16, l5: 16, l15: 16 } }));
  assert.ok(idle >= 58 && idle < 75, `idle ${idle}`);
  assert.ok(hot > idle && hot <= 180, `hot ${hot}`);
});

test("bytes per second formatting", () => {
  assert.equal(bps(512), "512 B/s");
  assert.equal(bps(1536), "1.5 KB/s");
  assert.equal(bps(5 * 1024 * 1024), "5.0 MB/s");
  assert.equal(bps(null), "–");
});

test("score color follows thresholds", () => {
  assert.equal(scoreColor(90), "var(--good)");
  assert.equal(scoreColor(60), "var(--warning)");
  assert.equal(scoreColor(10), "var(--critical)");
  assert.equal(scoreColor(90, true), "var(--text-muted)");
});
