#!/usr/bin/env node
/**
 * End-to-end smoke test against a running server (default http://localhost:3000).
 * Simulates: browser mints token -> agent pairs -> agent ingests -> dashboard,
 * alerts, share toggle, public page, OG image, incidents, magic link.
 *
 *   pnpm smoke                 # against localhost:3000
 *   BASE=https://x.vercel.app pnpm smoke
 */
const BASE = process.env.BASE ?? "http://localhost:3000";
let cookie = "";
let failures = 0;

function check(name, ok, extra = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? " " + extra : ""}`);
  if (!ok) failures++;
}

async function call(path, init = {}, withCookie = true) {
  const headers = { ...(init.headers ?? {}) };
  if (withCookie && cookie) headers.cookie = cookie;
  const r = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  const sc = r.headers.getSetCookie?.() ?? [];
  for (const c of sc) {
    const kv = c.split(";")[0];
    const [k] = kv.split("=");
    cookie = cookie
      .split("; ")
      .filter((x) => x && !x.startsWith(k + "="))
      .concat(kv)
      .join("; ");
  }
  return r;
}

function report(overrides = {}) {
  return {
    v: 1,
    at: new Date().toISOString(),
    hostname: "smoke-box",
    os: "linux",
    arch: "amd64",
    kernel: "6.8.0-smoke",
    uptime_s: 123456,
    agent_version: "smoke",
    cpu: { pct: 23.5, cores: 4 },
    load: { l1: 0.5, l5: 0.6, l15: 0.7 },
    mem: { total_b: 8e9, used_b: 4e9, avail_b: 4e9, pct: 50 },
    swap: { total_b: 2e9, used_b: 1e8, pct: 5 },
    disks: [{ mount: "/", fs: "ext4", total_b: 100e9, used_b: 50e9, pct: 50 }],
    top_procs: [{ pid: 1, name: "systemd", cpu_pct: 0.1, mem_pct: 0.1, rss_b: 1e7 }],
    oom: { supported: true, kills_total: 0, recent: [] },
    tools: [{ name: "claude", path: "/usr/local/bin/claude", version: "2.1.0 (Claude Code)" }],
    jobs: [{ name: "claude", kind: "Claude Code", pid: 4242, cpu_pct: 12, rss_b: 5e8, elapsed_s: 3600 }],
    ...overrides,
  };
}

async function main() {
  console.log("smoke against", BASE);

  // install.sh
  let r = await call("/install.sh", {}, false);
  const sh = await r.text();
  check("install.sh served", r.ok && sh.includes("install --server"));

  // mint token
  r = await call("/api/pair-tokens", { method: "POST" });
  const minted = await r.json();
  check("mint pair token", r.ok && minted.token?.startsWith("pair_"), minted.token);
  check("owner cookie set", cookie.includes("vv_owner="));

  // poll before pairing
  r = await call(`/api/pair-tokens/${minted.token}`);
  check("poll unpaired", r.ok && (await r.json()).paired === false);

  // agent pairs
  r = await call("/api/pair", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pair_token: minted.token, hostname: "smoke-box", os: "linux", arch: "amd64", agent_version: "smoke" }),
  }, false);
  const paired = await r.json();
  check("agent pair", r.ok && paired.machine_token?.startsWith("mvt_") && paired.machine_id?.startsWith("m_"), paired.machine_id);
  const mid = paired.machine_id;
  const mtok = paired.machine_token;

  // bad token rejected
  r = await call("/api/pair", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pair_token: "pair_nope" }) }, false);
  check("unknown pair token 404", r.status === 404);

  // ingest
  const ingest = (body) =>
    call("/api/ingest", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${mtok}` }, body: JSON.stringify(body) }, false);
  r = await ingest(report());
  check("ingest #1", r.ok && (await r.json()).ok === true);
  r = await call("/api/ingest", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer mvt_bad" }, body: "{}" }, false);
  check("ingest bad token 401", r.status === 401);

  // poll after pairing
  r = await call(`/api/pair-tokens/${minted.token}`);
  const pp = await r.json();
  check("poll paired+reporting", pp.paired === true && pp.reporting === true);

  // dashboard snapshot
  r = await call(`/api/machines/${mid}`);
  let snap = await r.json();
  check("dashboard snapshot", r.ok && snap.report?.cpu?.pct === 23.5 && snap.health === "ok", `health=${snap.health}`);

  // forbidden without cookie
  r = await call(`/api/machines/${mid}`, {}, false);
  check("dashboard forbidden w/o cookie", r.status === 403);

  // alerts: disk 90 -> warning; disk 97 -> critical; OOM; job died
  await ingest(report({ disks: [{ mount: "/", fs: "ext4", total_b: 100e9, used_b: 90e9, pct: 90 }] }));
  r = await call(`/api/machines/${mid}`);
  snap = await r.json();
  check("disk warning alert", snap.health === "warning" && snap.alerts.some((a) => a.kind === "disk" && !a.resolved_at && a.severity === "warning"));

  await ingest(report({ disks: [{ mount: "/", fs: "ext4", total_b: 100e9, used_b: 97e9, pct: 97 }], oom: { supported: true, kills_total: 1, recent: ["Killed process 4242 (claude)"] }, jobs: [] }));
  r = await call(`/api/machines/${mid}`);
  snap = await r.json();
  const kinds = snap.alerts.filter((a) => !a.resolved_at).map((a) => a.kind).sort();
  check("critical disk + oom + job_died", snap.health === "critical" && kinds.includes("oom") && kinds.includes("job_died") && kinds.includes("disk"), kinds.join(","));

  // recovery resolves disk alert
  await ingest(report({ oom: { supported: true, kills_total: 1, recent: [] }, jobs: [] }));
  r = await call(`/api/machines/${mid}`);
  snap = await r.json();
  check("disk alert resolved on recovery", !snap.alerts.some((a) => a.kind === "disk" && !a.resolved_at));

  // samples
  r = await call(`/api/machines/${mid}/samples?range=1h`);
  const s = await r.json();
  check("samples series", r.ok && Array.isArray(s.samples) && s.samples.length >= 1, `${s.samples?.length} buckets`);

  // share: private by default
  r = await call(`/api/machines/${mid}`);
  const slug = (await r.json()).machine.share_slug;
  r = await call(`/s/${slug}`, {}, false);
  check("share page 404 while private", r.status === 404);
  r = await call(`/api/machines/${mid}/samples?range=1h`, {}, false);
  check("samples forbidden while private", r.status === 403);

  r = await call(`/api/machines/${mid}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ share_public: true, name: "Smoke Box" }) });
  check("toggle public + rename", r.ok && (await r.json()).machine.share_public === true);
  r = await call(`/s/${slug}`, {}, false);
  const html = await r.text();
  check("share page renders", r.ok && html.includes("Smoke Box") && html.includes("og:image"));
  r = await call(`/s/${slug}/opengraph-image`, {}, false);
  const ct = r.headers.get("content-type") ?? "";
  check("OG image renders PNG", r.ok && ct.includes("image/png"), ct);
  r = await call(`/api/machines/${mid}/samples?range=24h`, {}, false);
  check("samples public when shared", r.ok);

  // incidents
  r = await call(`/api/machines/${mid}/incidents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Disk filled up", what_broke: "node_modules caches", severity: "major" }) });
  const inc = (await r.json()).incident;
  check("create incident", r.status === 201 && inc?.id?.startsWith("inc_") && inc.resolved_at === null);
  r = await call(`/api/machines/${mid}/incidents/${inc.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ what_fixed: "pnpm store prune", resolved: true }) });
  check("resolve incident", r.ok && (await r.json()).incident.resolved_at !== null);
  r = await call(`/api/machines/${mid}/incidents`, {}, false);
  check("incidents public when shared", r.ok && (await r.json()).incidents.length === 1);
  r = await call(`/api/machines/${mid}/incidents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "nope" }) }, false);
  check("incident create forbidden w/o cookie", r.status === 403);

  // claim: magic link (printed to log when no RESEND_API_KEY)
  r = await call("/api/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "smoke@example.com" }) });
  check("claim request", r.ok);

  // re-pair with same token rotates machine token, no duplicate
  r = await call("/api/pair", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pair_token: minted.token, hostname: "smoke-box", os: "linux", arch: "amd64" }) }, false);
  const re = await r.json();
  check("re-pair same machine", r.ok && re.machine_id === mid && re.machine_token !== mtok);
  r = await ingest(report());
  check("old token rejected after re-pair", r.status === 401);

  // homepage lists it
  r = await call("/");
  check("home lists machine", r.ok && (await r.text()).includes("Smoke Box"));

  // cleanup
  if (!process.env.KEEP) {
    r = await call(`/api/machines/${mid}`, { method: "DELETE" });
    check("delete machine", r.ok);
  } else {
    console.log(`kept machine ${mid}; dashboard: ${BASE}/m/${mid}`);
  }

  console.log(failures === 0 ? "\nall good" : `\n${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
