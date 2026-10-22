"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Sample } from "@/lib/types";
import { bps } from "@/lib/vitals";

const RANGES = ["1h", "6h", "24h", "7d"] as const;
type Range = (typeof RANGES)[number];


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
      <CartesianGrid stroke="#1a1a1a" vertical={false} />
      <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmtTime} tick={tick} stroke="#262626" minTickGap={56} />
    </>
  );

  const panels: { key: "cpu_pct" | "mem_pct" | "disk_pct" | "load1"; title: string; pct: boolean }[] = [
    { key: "cpu_pct", title: "CPU", pct: true },
    { key: "mem_pct", title: "Memory", pct: true },
    { key: "disk_pct", title: "Disk /", pct: true },
    { key: "load1", title: "Load, 1 min", pct: false },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker">history</div>
          <h2 className="mt-2 text-xl font-bold tracking-tight">{RANGE_TITLE[range]}</h2>
        </div>
        <div className="seg" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)} aria-pressed={r === range}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="shimmer h-56 rounded-lg border border-line" />
      ) : data.length < 2 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-center text-sm text-muted">
          <div>Two heartbeats make a line. One more report and the charts wake up.</div>
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line ${compact ? "" : "md:grid-cols-2"}`}>
          {panels.map((p) => {
            const last = [...data].reverse().find((d) => d[p.key] != null)?.[p.key];
            return (
              <Panel key={p.key} title={p.title} value={last == null ? "–" : p.pct ? `${last}%` : String(last)}>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -22 }}>
                    <defs>
                      <Grad id={p.key} />
                    </defs>
                    {axis}
                    <YAxis domain={p.pct ? [0, 100] : [0, "auto"]} ticks={p.pct ? [0, 50, 100] : undefined} tick={tick} stroke="transparent" unit={p.pct ? "%" : ""} />
                    <Tooltip content={<Tip fmtTime={fmtTime} fmt={(v) => (p.pct ? `${v}%` : String(v))} />} cursor={{ stroke: "var(--muted)", strokeWidth: 1 }} />
                    <Area type="monotone" dataKey={p.key} name={p.title} stroke="#ffffff" fill={`url(#grad-${p.key})`} strokeWidth={1.75} dot={false} activeDot={{ r: 4, fill: "#ffffff", stroke: "#000", strokeWidth: 2 }} isAnimationActive={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>
            );
          })}
          {hasNet && (
            <Panel title="Network" wide={!compact} legend>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -10 }}>
                  <defs>
                    <Grad id="net" />
                  </defs>
                  {axis}
                  <YAxis domain={[0, "auto"]} tick={tick} stroke="transparent" tickFormatter={(v: number) => bpsShort(v)} width={44} />
                  <Tooltip content={<Tip fmtTime={fmtTime} fmt={(v) => bps(v)} />} cursor={{ stroke: "var(--muted)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="net_rx_bps" name="Download" stroke="#ffffff" fill="url(#grad-net)" strokeWidth={1.75} dot={false} isAnimationActive={false} connectNulls />
                  <Area type="monotone" dataKey="net_tx_bps" name="Upload" stroke="#8a8a8a" strokeDasharray="4 3" fill="none" strokeWidth={1.75} dot={false} isAnimationActive={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
          )}
        </div>
      )}
    </section>
  );
}

const tick = { fill: "#8a8a8a", fontSize: 10, fontFamily: "var(--font-mono)" };

function Grad({ id }: { id: string }) {
  return (
    <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ffffff" stopOpacity={0.16} />
      <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
    </linearGradient>
  );
}

function Panel({ title, value, children, wide = false, legend = false }: { title: string; value?: string; children: React.ReactNode; wide?: boolean; legend?: boolean }) {
  return (
    <div className={`min-w-0 bg-black p-4 ${wide ? "md:col-span-2" : ""}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="kicker">{title}</div>
        {value && <div className="text-sm font-bold">{value}</div>}
        {legend && (
          <ul className="flex gap-4 text-xs text-fg-2">
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-4 border-t-2 border-white" /> download
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-4 border-t-2 border-dashed border-muted" /> upload
            </li>
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
    <div className="rounded-md border border-line-strong bg-black px-3 py-2 text-xs">
      <div className="mb-1 text-muted">{fmtTime(label)}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="text-fg-2">{p.name}</span>
          <span className="ml-auto pl-4 font-bold text-fg">{p.value == null ? "–" : fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function bpsShort(v: number) {
  if (v >= 1024 * 1024) return `${(v / 1024 / 1024).toFixed(1)}M`;
  if (v >= 1024) return `${Math.round(v / 1024)}K`;
  return String(Math.round(v));
}
