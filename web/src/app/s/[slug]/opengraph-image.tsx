import { ImageResponse } from "next/og";
import { q, one } from "@/lib/db";
import { OFFLINE_AFTER_MS, type Alert, type Machine } from "@/lib/types";
import { bytes, osLabel, duration } from "@/lib/format";
import { healthScore, moodFor, rootDisk } from "@/lib/vitals";

export const runtime = "nodejs";
export const alt = "Live machine health card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEX: Record<string, string> = {
  "var(--good)": "#34d399",
  "var(--warning)": "#fbbf24",
  "var(--critical)": "#fb7185",
  "var(--info)": "#8b90a8",
  "var(--text-muted)": "#767a93",
};

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await one<Machine>(`SELECT * FROM machines WHERE share_slug = $1 AND share_public = true`, [slug]);
  if (!m) return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#090a12", color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 48 }}>Not found</div>, size);

  const alerts = await q<Alert>(`SELECT severity FROM alerts WHERE machine_id = $1 AND resolved_at IS NULL`, [m.id]);
  const spark = await q<{ cpu_pct: number | null }>(
    `SELECT avg(cpu_pct)::float8 AS cpu_pct FROM samples WHERE machine_id = $1 AND at > now() - interval '1 hour'
      GROUP BY floor(extract(epoch from at) / 60) ORDER BY 1`,
    [m.id],
  );
  const offline = !m.last_seen_at || Date.now() - new Date(m.last_seen_at).getTime() > OFFLINE_AFTER_MS;
  const input = { report: m.last_report, offline, openSeverities: alerts.map((a) => a.severity) };
  const score = healthScore(input);
  const mood = moodFor(input);
  const color = HEX[mood.color] ?? "#8b90a8";
  const r = m.last_report;
  const root = rootDisk(r);

  const stats = r
    ? [
        { k: "CPU", v: `${Math.round(r.cpu.pct)}%`, p: r.cpu.pct, c: "#38bdf8" },
        { k: "MEM", v: `${Math.round(r.mem.pct)}%`, p: r.mem.pct, c: "#c084fc" },
        { k: "DISK", v: root ? `${Math.round(root.pct)}%` : "–", p: root?.pct ?? 0, c: "#a3e635" },
        { k: "JOBS", v: String(r.jobs.length), p: null, c: "#f472b6" },
      ]
    : [];

  // score ring geometry
  const R = 86;
  const C = 2 * Math.PI * R;
  const arc = 0.75 * C;
  const filled = r && !offline ? arc * (score / 100) : 0;

  // one-hour cpu sparkline
  const vals = spark.map((s) => s.cpu_pct ?? 0);
  const W = 1088;
  const H = 70;
  const path =
    vals.length >= 2
      ? vals.map((v, i) => `${i === 0 ? "M" : "L"}${((i / (vals.length - 1)) * W).toFixed(1)} ${(H - 4 - (Math.min(100, v) / 100) * (H - 8)).toFixed(1)}`).join(" ")
      : "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          color: "#f3f2ff",
          padding: 56,
          fontFamily: "sans-serif",
          backgroundColor: "#090a12",
          backgroundImage: "radial-gradient(circle at 10% 0%, rgba(139,92,246,0.35), transparent 55%), radial-gradient(circle at 100% 10%, rgba(56,189,248,0.25), transparent 50%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#b3b6cc" }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: color }} />
            my AI&apos;s computer, live
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#767a93" }}>VM Vitals</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 28 }}>
          <div style={{ display: "flex", position: "relative", width: 220, height: 220, alignItems: "center", justifyContent: "center" }}>
            <svg width="220" height="220" viewBox="0 0 220 220" style={{ position: "absolute", top: 0, left: 0, transform: "rotate(135deg)" }}>
              <circle cx="110" cy="110" r={R} fill="none" stroke="#2a2f42" strokeWidth="18" strokeDasharray={`${arc} ${C}`} strokeLinecap="round" />
              <circle cx="110" cy="110" r={R} fill="none" stroke={color} strokeWidth="18" strokeDasharray={`${Math.max(0.01, filled)} ${C}`} strokeLinecap="round" />
            </svg>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color, lineHeight: 1 }}>{r && !offline ? score : "–"}</div>
              <div style={{ display: "flex", fontSize: 16, color: "#767a93", letterSpacing: 4, marginTop: 6 }}>SCORE</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>{m.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14 }}>
              <div style={{ display: "flex", fontSize: 44 }}>{mood.emoji}</div>
              <div style={{ display: "flex", fontSize: 34, color, fontWeight: 600 }}>{mood.label}</div>
            </div>
            <div style={{ display: "flex", fontSize: 22, color: "#767a93", marginTop: 10 }}>
              {osLabel(m.os)} {m.arch}
              {r ? ` · up ${duration(r.uptime_s)} · ${bytes(r.mem.total_b, 0)} RAM · ${r.cpu.cores} cores` : " · listening for the first heartbeat"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 28 }}>
          {stats.map((s) => (
            <div key={s.k} style={{ display: "flex", flexDirection: "column", flex: 1, background: "rgba(16,18,28,0.9)", border: "1px solid #242838", borderRadius: 16, padding: "18px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, color: "#767a93", letterSpacing: 2 }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, background: s.c }} />
                {s.k}
              </div>
              <div style={{ display: "flex", fontSize: 48, fontWeight: 700, marginTop: 2 }}>{s.v}</div>
              {s.p != null && (
                <div style={{ display: "flex", height: 8, borderRadius: 4, background: "#1f2333", marginTop: 10 }}>
                  <div style={{ display: "flex", width: `${Math.max(2, Math.min(100, s.p))}%`, height: 8, borderRadius: 4, background: s.p >= 95 ? "#fb7185" : s.p >= 85 ? "#fbbf24" : s.c }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", marginTop: "auto", flexDirection: "column" }}>
          {path && (
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
              <path d={`${path} L${W} ${H} L0 ${H} Z`} fill="rgba(56,189,248,0.12)" />
              <path d={path} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinejoin="round" />
            </svg>
          )}
          <div style={{ display: "flex", fontSize: 20, color: "#767a93", justifyContent: "space-between", marginTop: 8 }}>
            <div style={{ display: "flex" }}>{r && r.jobs.length > 0 ? `Awake: ${[...new Set(r.jobs.map((j) => j.kind || j.name))].slice(0, 4).join(", ")}` : path ? "CPU, last hour" : "No agent jobs awake"}</div>
            <div style={{ display: "flex" }}>{alerts.length ? `${alerts.length} open alert${alerts.length === 1 ? "" : "s"}` : mood.quip}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, emoji: "twemoji" },
  );
}
