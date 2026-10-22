/**
 * Maps a report onto Grok Bot's four friends. Pure and client-safe; used by
 * the dashboard, the share page and the OG images so they always agree.
 */
import type { Report } from "./types";
import { bps, rootDisk } from "./vitals";
import { exprFor, type Expr } from "@/components/Critters";

export type FriendKind = "chip" | "mem" | "disk" | "net";

export interface Friend {
  kind: FriendKind;
  label: string;
  level: number | null;
  expr: Expr;
  value: string;
  /** Overrides the liquid color; Ping stays white because busy pipes aren't bad. */
  liquid?: string;
}

/** Throughput on a log scale: 1 KB/s ≈ 38, 1 MB/s ≈ 75, 100 MB/s = 100. */
export function netLevel(rx?: number | null, tx?: number | null): number | null {
  if (rx == null && tx == null) return null;
  const total = (rx ?? 0) + (tx ?? 0);
  return Math.max(0, Math.min(100, (Math.log10(total + 1) / 8) * 100));
}

export function crewFor(r: Report | null, offline: boolean): Friend[] {
  const noData = !r;
  const disk = rootDisk(r);
  const net = netLevel(r?.net?.rx_bps, r?.net?.tx_bps);
  const face = (level: number | null | undefined) => exprFor(level, { offline, noData });
  const netFace = (): Expr => {
    const e = exprFor(net, { offline, noData: noData || net == null });
    return e === "sweaty" || e === "panic" ? "busy" : e;
  };
  return [
    { kind: "chip", label: "cpu", level: r?.cpu.pct ?? null, expr: face(r?.cpu.pct), value: r ? `${Math.round(r.cpu.pct)}%` : "–" },
    { kind: "mem", label: "mem", level: r?.mem.pct ?? null, expr: face(r?.mem.pct), value: r ? `${Math.round(r.mem.pct)}%` : "–" },
    { kind: "disk", label: "disk", level: disk?.pct ?? null, expr: face(disk?.pct), value: disk ? `${Math.round(disk.pct)}%` : "–" },
    { kind: "net", label: "net", level: net, expr: netFace(), value: r?.net ? bps(r.net.rx_bps + r.net.tx_bps) : "–", liquid: "#ffffff" },
  ];
}
