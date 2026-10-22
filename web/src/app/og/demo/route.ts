import { shareCard } from "@/lib/og";
import { crewFor } from "@/lib/crew";
import type { Report } from "@/lib/types";

export const runtime = "nodejs";

/** The share card with made-up numbers, for the landing page and the README. */
export async function GET() {
  const r = {
    cpu: { pct: 41, cores: 8 },
    mem: { pct: 68, total_b: 16e9, used_b: 10.9e9, avail_b: 5.1e9 },
    disks: [{ mount: "/", total_b: 500e9, used_b: 437e9, pct: 87 }],
    net: { rx_bps: 410e3, tx_bps: 96e3, rx_total_b: 0, tx_total_b: 0 },
  } as unknown as Report;
  const cpu = Array.from({ length: 60 }, (_, i) => 30 + 18 * Math.sin(i / 5) + 9 * Math.sin(i / 1.7) + (i > 40 && i < 47 ? 30 : 0));
  const res = await shareCard({
    id: "demo",
    name: "grok-mini",
    mood: { key: "humming", label: "Humming along", quip: "" },
    score: 86,
    sub: "awake: grok bot, claude code",
    crew: crewFor(r, false),
    cpu,
    host: "",
  });
  res.headers.set("cache-control", "public, max-age=3600, s-maxage=86400");
  return res;
}
