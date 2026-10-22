"use client";

import { useEffect, useState } from "react";
import type { Report, Sample } from "@/lib/types";
import { bytes } from "@/lib/format";
import { bps, rootDisk } from "@/lib/vitals";
import { crewFor } from "@/lib/crew";
import { CREW, Critter } from "./Critters";
import { Sparkline } from "./Sparkline";

/** The four friends, live: a critter per metric, the number, and an hour of sparkline. */
export function CrewBoard({ machineId, report, offline, refreshMs = 15000 }: { machineId: string; report: Report | null; offline: boolean; refreshMs?: number }) {
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

  const s = samples ?? [];
  const crew = crewFor(report, offline);
  const disk = rootDisk(report);
  const r = report;
  const detail: Record<string, string> = {
    chip: r ? `${r.cpu.cores} cores · load ${r.load.l1.toFixed(2)}` : "counting cores…",
    mem: r ? `${bytes(r.mem.used_b)} of ${bytes(r.mem.total_b)}${r.swap.total_b ? ` · swap ${Math.round(r.swap.pct)}%` : ""}` : "weighing the ram…",
    disk: disk ? `${bytes(disk.total_b - disk.used_b)} free on ${disk.mount}` : r ? "no disks found" : "measuring the disk…",
    net: r?.net ? `↓ ${bps(r.net.rx_bps)} · ↑ ${bps(r.net.tx_bps)}` : r ? "first reading needs two heartbeats" : "sniffing the network…",
  };
  const spark: Record<string, (number | null)[]> = {
    chip: s.map((x) => x.cpu_pct),
    mem: s.map((x) => x.mem_pct),
    disk: s.map((x) => x.disk_pct),
    net: s.map((x) => (x.net_rx_bps == null ? null : x.net_rx_bps + (x.net_tx_bps ?? 0))),
  };

  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4" aria-label="CPU, memory, disk and network">
      {crew.map((f, i) => (
        <div key={f.kind} className="flex min-w-0 flex-col bg-black p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="kicker">
                <span className="hidden sm:inline">{CREW[f.kind].name} · </span>
                {f.label}
              </div>
              <div className="display mt-2 text-4xl sm:text-5xl" style={{ color: f.kind !== "net" && f.level != null && f.level >= 85 ? (f.level >= 95 ? "var(--bad)" : "var(--warn)") : undefined }}>
                {f.kind === "net" && r?.net ? <Unit text={bps(r.net.rx_bps + r.net.tx_bps)} /> : <Unit text={f.value} />}
              </div>
            </div>
            <Critter kind={f.kind} id={`board-${machineId}-${f.kind}`} level={f.level} expr={f.expr} liquid={f.liquid} size={64} delay={i * 0.4} className="h-12 w-12 shrink-0 sm:h-16 sm:w-16" />
          </div>
          <div className="mt-2 truncate text-xs text-muted">{detail[f.kind]}</div>
          <div className="mt-auto h-10 pt-3">
            <Sparkline values={spark[f.kind]} color="#ffffff" max={f.kind === "net" ? undefined : 100} />
          </div>
        </div>
      ))}
    </section>
  );
}

/** "366 KB/s" -> big 366, small KB/s. "74%" keeps the % small too. */
function Unit({ text }: { text: string }) {
  const m = text.match(/^([\d.–-]+)\s*(.*)$/);
  if (!m) return <>{text}</>;
  return (
    <>
      {m[1]}
      {m[2] && <span className="ml-0.5 text-base font-bold tracking-normal text-muted sm:text-lg">{m[2]}</span>}
    </>
  );
}
