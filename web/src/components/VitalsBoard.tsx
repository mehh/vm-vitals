"use client";

import { useEffect, useState } from "react";
import type { Report, Sample } from "@/lib/types";
import { bytes } from "@/lib/format";
import { bps, rootDisk } from "@/lib/vitals";
import { Gauge } from "./Gauge";
import { Sparkline } from "./Sparkline";

/** Four live tiles: CPU, memory, disk, network. Gauges plus one-hour sparklines. */
export function VitalsBoard({ machineId, report, refreshMs = 15000 }: { machineId: string; report: Report | null; refreshMs?: number }) {
  const [samples, setSamples] = useState<Sample[] | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const r = await fetch(`/api/machines/${machineId}/samples?range=1h`, { cache: "no-store" });
      if (!r.ok || !alive) return;
      setSamples((await r.json()).samples);
    }
    load();
    const t = setInterval(load, refreshMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [machineId, refreshMs]);

  if (!report) return <WaitingTiles />;
  const s = samples ?? [];
  const disk = rootDisk(report);
  const net = report.net;
  const hasNet = s.some((x) => x.net_rx_bps != null) || !!net;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="CPU" color="var(--series-1)" pct={report.cpu.pct} value={`${Math.round(report.cpu.pct)}%`} sub={`${report.cpu.cores} cores · load ${report.load.l1.toFixed(2)}`} spark={s.map((x) => x.cpu_pct)} max={100} />
      <Tile label="Memory" color="var(--series-2)" pct={report.mem.pct} value={`${Math.round(report.mem.pct)}%`} sub={`${bytes(report.mem.used_b)} of ${bytes(report.mem.total_b)}`} spark={s.map((x) => x.mem_pct)} max={100} />
      <Tile label={`Disk ${disk?.mount ?? ""}`} color="var(--series-3)" pct={disk?.pct} value={disk ? `${Math.round(disk.pct)}%` : "–"} sub={disk ? `${bytes(disk.total_b - disk.used_b)} free` : "no disks found"} spark={s.map((x) => x.disk_pct)} max={100} />
      {hasNet ? (
        <NetTile net={net} samples={s} />
      ) : (
        <div className="card flex flex-col p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--series-5)" }} />
            Network
          </div>
          <div className="mt-2 text-sm text-secondary">This agent can&apos;t feel the network yet.</div>
          <div className="mt-1 text-xs text-muted">Re-run the install line and v0.2 will start counting bytes.</div>
          <div className="mt-auto h-10 opacity-50">
            <Sparkline values={[]} color="var(--series-5)" />
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, color, pct, value, sub, spark, max }: { label: string; color: string; pct: number | null | undefined; value: string; sub: string; spark: (number | null)[]; max?: number }) {
  const hot = (pct ?? 0) >= 95 ? "var(--critical)" : (pct ?? 0) >= 85 ? "var(--warning)" : color;
  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-center gap-3">
        <Gauge pct={pct} color={hot} size={72} stroke={10}>
          <div className="mono text-base font-bold">{value}</div>
        </Gauge>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
            {label}
          </div>
          <div className="mt-1 text-xs text-secondary">{sub}</div>
        </div>
      </div>
      <div className="mt-3 h-10">
        <Sparkline values={spark} color={color} max={max} />
      </div>
    </div>
  );
}

function NetTile({ net, samples }: { net: Report["net"]; samples: Sample[] }) {
  const rx = samples.map((x) => x.net_rx_bps);
  const tx = samples.map((x) => x.net_tx_bps);
  const peak = Math.max(1, ...rx.map((v) => v ?? 0), ...tx.map((v) => v ?? 0)) * 1.08;
  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--series-5)" }} />
        Network
      </div>
      <div className="mono mt-1 flex items-baseline gap-3">
        <span className="text-base font-bold" style={{ color: "var(--series-5)" }}>
          ↓ {bps(net?.rx_bps)}
        </span>
        <span className="text-base font-bold text-s1">↑ {bps(net?.tx_bps)}</span>
      </div>
      <div className="mt-1 text-xs text-secondary">{net ? `${bytes(net.rx_total_b, 0)} in · ${bytes(net.tx_total_b, 0)} out since boot` : "last hour"}</div>
      <div className="relative mt-3 h-10">
        <div className="absolute inset-0">
          <Sparkline values={rx} color="var(--series-5)" max={peak} />
        </div>
        <div className="absolute inset-0">
          <Sparkline values={tx} color="var(--series-1)" max={peak} fill={false} />
        </div>
      </div>
    </div>
  );
}

function WaitingTiles() {
  const quips = ["counting cores…", "weighing the RAM…", "measuring the disk…", "sniffing the network…"];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {quips.map((q) => (
        <div key={q} className="card flex h-32 flex-col justify-between p-4">
          <div className="shimmer h-3 w-20 rounded" />
          <div className="text-xs text-muted">{q}</div>
          <div className="shimmer h-8 rounded" />
        </div>
      ))}
    </div>
  );
}
