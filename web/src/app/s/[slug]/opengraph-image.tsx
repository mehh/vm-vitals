import { ImageResponse } from "next/og";
import { q, one } from "@/lib/db";
import { OFFLINE_AFTER_MS, type Alert, type Machine } from "@/lib/types";
import { bytes, healthOf, HEALTH_LABEL, osLabel, duration } from "@/lib/format";

export const runtime = "nodejs";
export const alt = "Live machine health card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLORS = {
  ok: "#22a06b",
  warning: "#c98500",
  critical: "#e66767",
  offline: "#8a8f99",
};

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await one<Machine>(`SELECT * FROM machines WHERE share_slug = $1 AND share_public = true`, [slug]);
  if (!m) return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#0e0f11", color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 48 }}>Not found</div>, size);

  const alerts = await q<Alert>(`SELECT severity FROM alerts WHERE machine_id = $1 AND resolved_at IS NULL`, [m.id]);
  const offline = !m.last_seen_at || Date.now() - new Date(m.last_seen_at).getTime() > OFFLINE_AFTER_MS;
  const health = healthOf({ offline, severities: alerts.map((a) => a.severity) });
  const r = m.last_report;
  const root = r?.disks.find((d) => d.mount === "/") ?? r?.disks[0];
  const color = COLORS[health];

  const stats = r
    ? [
        { k: "CPU", v: `${Math.round(r.cpu.pct)}%`, p: r.cpu.pct, c: "#3987e5" },
        { k: "MEM", v: `${Math.round(r.mem.pct)}%`, p: r.mem.pct, c: "#d95926" },
        { k: "DISK", v: root ? `${Math.round(root.pct)}%` : "–", p: root?.pct ?? 0, c: "#199e70" },
        { k: "JOBS", v: String(r.jobs.length), p: null, c: "#c98500" },
      ]
    : [];

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0e0f11", color: "#f0efec", padding: 56, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#b8b7af" }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: color }} />
            my AI&apos;s computer, live
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#7d7c75" }}>VM Vitals</div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 36 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>{m.name}</div>
          <div style={{ display: "flex", fontSize: 30, color, border: `2px solid ${color}`, borderRadius: 999, padding: "6px 20px" }}>{HEALTH_LABEL[health]}</div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#7d7c75", marginTop: 8 }}>
          {osLabel(m.os)} {m.arch}
          {r ? ` · up ${duration(r.uptime_s)} · ${bytes(r.mem.total_b, 0)} RAM · ${r.cpu.cores} cores` : " · waiting for first report"}
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 56 }}>
          {stats.map((s) => (
            <div key={s.k} style={{ display: "flex", flexDirection: "column", flex: 1, background: "#16181c", border: "1px solid #2a2e36", borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, color: "#7d7c75", letterSpacing: 2 }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, background: s.c }} />
                {s.k}
              </div>
              <div style={{ display: "flex", fontSize: 64, fontWeight: 700, marginTop: 6 }}>{s.v}</div>
              {s.p != null && (
                <div style={{ display: "flex", height: 10, borderRadius: 5, background: "#1d2026", marginTop: 14 }}>
                  <div style={{ display: "flex", width: `${Math.max(2, Math.min(100, s.p))}%`, height: 10, borderRadius: 5, background: s.p >= 95 ? "#e66767" : s.p >= 85 ? "#c98500" : s.c }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", marginTop: "auto", fontSize: 22, color: "#7d7c75", justifyContent: "space-between" }}>
          <div style={{ display: "flex" }}>
            {r && r.jobs.length > 0 ? `Running: ${[...new Set(r.jobs.map((j) => j.kind || j.name))].slice(0, 4).join(", ")}` : "No agent jobs running"}
          </div>
          <div style={{ display: "flex" }}>{alerts.length ? `${alerts.length} open alert${alerts.length === 1 ? "" : "s"}` : "no alerts"}</div>
        </div>
      </div>
    ),
    size,
  );
}
