"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Sample } from "@/lib/types";
import { bps } from "@/lib/vitals";

const RANGES = ["1h", "6h", "24h", "7d"] as const;
type Range = (typeof RANGES)[number];

const SERIES = {
  cpu_pct: { label: "CPU", color: "var(--series-1)" },
  mem_pct: { label: "Memory", color: "var(--series-2)" },
  disk_pct: { label: "Disk /", color: "var(--series-3)" },
  load1: { label: "Load (1m)", color: "var(--series-4)" },
  net_rx_bps: { label: "Download", color: "var(--series-5)" },
  net_tx_bps: { label: "Upload", color: "var(--series-1)" },
} as const;

const RANGE_TITLE: Record<Range, string> = {
  "1h": "The last hour, in squiggles",
  "6h": "Six hours of heartbeat",
  "24h": "A full day on the box",
  "7d": "The week, zoomed out",
};

export function Charts({ machineId, compact = false }: { machineId: string; compact?: boolean }) {
  const [range, setRange] = useState<Range>("1h");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      const r = await fetch(`/api/machines/${machineId}/samples?range=${range}`);
      if (!r.ok || !alive) return;
      const j = await r.json();
      setSamples(j.samples);
      setLoading(false);
    }
    load();
    const t = setInterval(load, range === "1h" ? 15000 : 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [machineId, range]);

  const data = samples.map((s) => ({
    t: new Date(s.at).getTime(),
    cpu_pct: s.cpu_pct == null ? null : Math.round(s.cpu_pct),
    mem_pct: s.mem_pct == null ? null : Math.round(s.mem_pct),
    disk_pct: s.disk_pct == null ? null : Math.round(s.disk_pct),
    load1: s.load1 == null ? null : Math.round(s.load1 * 10) / 10,
    net_rx_bps: s.net_rx_bps == null ? null : Math.round(s.net_rx_bps),
    net_tx_bps: s.net_tx_bps == null ? null : Math.round(s.net_tx_bps),
  }));
  const hasNet = data.some((d) => d.net_rx_bps != null);

  const fmtTime = (t: number) => {
    const d = new Date(t);
    return range === "7d" || range === "24h"
      ? d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })
      : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  const axis = (
    <>
      <CartesianGrid stroke="var(--border)" vertical={false} />
      <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmtTime} tick={tick} stroke="var(--border)" minTickGap={48} />
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{RANGE_TITLE[range]}</h2>
        <div className="seg" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)} aria-pressed={r === range} className="mono">
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card shimmer h-56" />
          <div className="card shimmer h-56" />
        </div>
      ) : data.length < 2 ? (
        <div className="card flex h-48 flex-col items-center justify-center gap-1 text-center text-sm text-muted">
          <div className="text-2xl" aria-hidden>
            📈
          </div>
          <div>Two heartbeats make a line. One more report and the charts wake up.</div>
        </div>
      ) : (
        <div className={`grid gap-4 ${compact ? "" : "md:grid-cols-2"}`}>
          <Panel title="CPU, memory, disk" legend={["cpu_pct", "mem_pct", "disk_pct"]}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  {(["cpu_pct", "mem_pct", "disk_pct"] as const).map((k) => (
                    <Grad key={k} id={k} color={SERIES[k].color} />
                  ))}
                </defs>
                {axis}
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={tick} stroke="transparent" unit="%" />
                <Tooltip content={<Tip fmtTime={fmtTime} fmt={(v) => `${v}%`} />} cursor={{ stroke: "var(--text-muted)", strokeWidth: 1 }} />
                {(["cpu_pct", "mem_pct", "disk_pct"] as const).map((k) => (
                  <Area key={k} type="monotone" dataKey={k} name={SERIES[k].label} stroke={SERIES[k].color} fill={`url(#grad-${k})`} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }} isAnimationActive={false} connectNulls />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="Load average (1m)" legend={["load1"]}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                {axis}
                <YAxis domain={[0, "auto"]} tick={tick} stroke="transparent" />
                <Tooltip content={<Tip fmtTime={fmtTime} fmt={(v) => String(v)} />} cursor={{ stroke: "var(--text-muted)", strokeWidth: 1 }} />
                <Line type="monotone" dataKey="load1" name="Load (1m)" stroke={SERIES.load1.color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }} isAnimationActive={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
          {hasNet && (
            <Panel title="Network" legend={["net_rx_bps", "net_tx_bps"]} wide={!compact}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -2 }}>
                  <defs>
                    <Grad id="net_rx_bps" color={SERIES.net_rx_bps.color} />
                    <Grad id="net_tx_bps" color={SERIES.net_tx_bps.color} />
                  </defs>
                  {axis}
                  <YAxis domain={[0, "auto"]} tick={tick} stroke="transparent" tickFormatter={(v: number) => bps(v)} width={64} />
                  <Tooltip content={<Tip fmtTime={fmtTime} fmt={(v) => bps(v)} />} cursor={{ stroke: "var(--text-muted)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="net_rx_bps" name="Download" stroke={SERIES.net_rx_bps.color} fill="url(#grad-net_rx_bps)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                  <Area type="monotone" dataKey="net_tx_bps" name="Upload" stroke={SERIES.net_tx_bps.color} fill="url(#grad-net_tx_bps)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

const tick = { fill: "var(--text-muted)", fontSize: 11 };

function Grad({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.35} />
      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
    </linearGradient>
  );
}

function Panel({ title, legend, children, wide = false }: { title: string; legend: (keyof typeof SERIES)[]; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`card p-4 ${wide ? "md:col-span-2" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        {legend.length > 1 && (
          <ul className="flex gap-3 text-xs text-secondary">
            {legend.map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: SERIES[k].color }} />
                {SERIES[k].label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {children}
    </div>
  );
}

type TipProps = {
  active?: boolean;
  payload?: { name: string; value: number | null; color: string }[];
  label?: number;
  fmtTime: (t: number) => string;
  fmt: (v: number) => string;
};

function Tip({ active, payload, label, fmtTime, fmt }: TipProps) {
  if (!active || !payload?.length || label == null) return null;
  return (
    <div className="card mono px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-muted">{fmtTime(label)}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-secondary">{p.name}</span>
          <span className="ml-auto pl-4 text-primary">{p.value == null ? "–" : fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
