"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Sample } from "@/lib/types";

const RANGES = ["1h", "6h", "24h", "7d"] as const;
type Range = (typeof RANGES)[number];

const SERIES = {
  cpu_pct: { label: "CPU", color: "var(--series-1)" },
  mem_pct: { label: "Memory", color: "var(--series-2)" },
  disk_pct: { label: "Disk /", color: "var(--series-3)" },
  load1: { label: "Load (1m)", color: "var(--series-4)" },
} as const;

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
  }));

  const fmtTime = (t: number) => {
    const d = new Date(t);
    return range === "7d" || range === "24h"
      ? d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })
      : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Last {range}</h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`mono rounded px-2 py-1 text-xs ${r === range ? "bg-surface-2 text-primary" : "text-muted hover:text-primary"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card h-48 animate-pulse" />
      ) : data.length < 2 ? (
        <div className="card flex h-48 items-center justify-center text-sm text-muted">
          Not enough samples yet. Charts fill in as reports arrive.
        </div>
      ) : (
        <div className={`grid gap-4 ${compact ? "" : "md:grid-cols-2"}`}>
          <Panel title="CPU, memory, disk" legend={["cpu_pct", "mem_pct", "disk_pct"]}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmtTime} tick={tick} stroke="var(--border)" minTickGap={48} />
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={tick} stroke="transparent" unit="%" />
                <Tooltip content={<Tip fmtTime={fmtTime} unit="%" />} cursor={{ stroke: "var(--text-muted)", strokeWidth: 1 }} />
                {(["cpu_pct", "mem_pct", "disk_pct"] as const).map((k) => (
                  <Area key={k} type="monotone" dataKey={k} name={SERIES[k].label} stroke={SERIES[k].color} fill={SERIES[k].color} fillOpacity={0.08} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }} isAnimationActive={false} connectNulls />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="Load average (1m)" legend={["load1"]}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={fmtTime} tick={tick} stroke="var(--border)" minTickGap={48} />
                <YAxis domain={[0, "auto"]} tick={tick} stroke="transparent" />
                <Tooltip content={<Tip fmtTime={fmtTime} unit="" />} cursor={{ stroke: "var(--text-muted)", strokeWidth: 1 }} />
                <Line type="monotone" dataKey="load1" name="Load (1m)" stroke={SERIES.load1.color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 2 }} isAnimationActive={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      )}
    </div>
  );
}

const tick = { fill: "var(--text-muted)", fontSize: 11 };

function Panel({ title, legend, children }: { title: string; legend: (keyof typeof SERIES)[]; children: React.ReactNode }) {
  return (
    <div className="card p-4">
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
  unit: string;
};

function Tip({ active, payload, label, fmtTime, unit }: TipProps) {
  if (!active || !payload?.length || label == null) return null;
  return (
    <div className="card mono px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 text-muted">{fmtTime(label)}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-secondary">{p.name}</span>
          <span className="ml-auto pl-4 text-primary">
            {p.value ?? "–"}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
