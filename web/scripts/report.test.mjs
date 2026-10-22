import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReport } from "../src/lib/report.ts";

/** What a v0.2.0 Linux agent sent from an overlay-root box: Go nil slices as null. */
function grokBoxReport(o = {}) {
  return {
    v: 1, at: "2026-10-21T20:00:00Z", hostname: "grok-bot", os: "linux", arch: "amd64", kernel: "6.8.0", uptime_s: 100, agent_version: "v0.2.0",
    cpu: { pct: 3.2, cores: 2 }, load: { l1: 0.1, l5: 0.1, l15: 0.05 },
    mem: { total_b: 4e9, used_b: 1e9, avail_b: 3e9, pct: 25 }, swap: { total_b: 0, used_b: 0, pct: 0 },
    disks: null, top_procs: null, oom: { supported: true, kills_total: 0 }, tools: null, jobs: null,
    ...o,
  };
}

test("null lists from the Linux agent are accepted (the 'malformed report' bug)", () => {
  const r = parseReport(grokBoxReport());
  assert.ok(r, "report must parse");
  assert.deepEqual(r.disks, []);
  assert.deepEqual(r.top_procs, []);
  assert.deepEqual(r.tools, []);
  assert.deepEqual(r.jobs, []);
  assert.equal(r.net, undefined);
  assert.equal(r.cpu.pct, 3.2);
  assert.equal(r.hostname, "grok-bot");
});

test("missing optional fields default instead of failing", () => {
  const r = parseReport({ v: 1, cpu: { pct: 1 }, mem: { pct: 2 } });
  assert.ok(r);
  assert.equal(r.swap.pct, 0);
  assert.equal(r.load.l1, 0);
  assert.deepEqual(r.disks, []);
  assert.equal(r.oom.supported, false);
  assert.deepEqual(r.oom.recent, []);
  assert.deepEqual(r.warnings, []);
});

test("unknown fields are dropped, known ones kept", () => {
  const r = parseReport(grokBoxReport({ gpu: { pct: 99 }, disks: [{ mount: "/", pct: 40, inodes_pct: 3, total_b: 10, used_b: 4 }] }));
  assert.ok(r);
  assert.equal("gpu" in r, false);
  assert.deepEqual(r.disks, [{ mount: "/", fs: "", total_b: 10, used_b: 4, pct: 40 }]);
});

test("v missing is treated as v1; a future v is not rejected", () => {
  assert.ok(parseReport({ cpu: { pct: 1 } }));
  assert.ok(parseReport({ v: 2, cpu: { pct: 1 } }));
});

test("wrong types become zero values rather than crashing", () => {
  const r = parseReport({ v: "1", cpu: "busy", mem: null, disks: "nope", top_procs: [null, 1, { pid: "12", name: 5 }], uptime_s: "42", warnings: "x" });
  assert.ok(r);
  assert.equal(r.cpu.pct, 0);
  assert.deepEqual(r.disks, []);
  assert.deepEqual(r.top_procs, [{ pid: 12, name: "", cpu_pct: 0, mem_pct: 0, rss_b: 0 }]);
  assert.equal(r.uptime_s, 42);
  assert.deepEqual(r.warnings, []);
});

test("only non-object bodies are malformed", () => {
  assert.equal(parseReport(null), null);
  assert.equal(parseReport([]), null);
  assert.equal(parseReport("report"), null);
  assert.equal(parseReport(42), null);
  assert.equal(parseReport({ v: 0 }), null);
});

test("lists and strings are capped", () => {
  const r = parseReport(grokBoxReport({ disks: Array.from({ length: 40 }, (_, i) => ({ mount: "/m" + i })), hostname: "h".repeat(500) }));
  assert.ok(r);
  assert.equal(r.disks.length, 16);
  assert.equal(r.hostname.length, 120);
});
