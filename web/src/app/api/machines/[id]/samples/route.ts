import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { getViewer, canManage } from "@/lib/auth";
import type { Machine, Sample } from "@/lib/types";

export const runtime = "nodejs";

const RANGES: Record<string, { interval: string; bucketS: number }> = {
  "1h": { interval: "1 hour", bucketS: 30 },
  "6h": { interval: "6 hours", bucketS: 120 },
  "24h": { interval: "24 hours", bucketS: 600 },
  "7d": { interval: "7 days", bucketS: 3600 },
};

/**
 * Time series for charts. Public-share viewers may read it when the machine
 * is public; otherwise owner-only.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const range = RANGES[url.searchParams.get("range") ?? "1h"] ?? RANGES["1h"];
  const m = await one<Machine>(`SELECT * FROM machines WHERE id = $1`, [id]);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!m.share_public) {
    const v = await getViewer();
    if (!canManage(m, v)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rows = await q<Sample>(
    `SELECT to_timestamp(floor(extract(epoch from at) / $3) * $3) AS at,
            avg(cpu_pct)::float8  AS cpu_pct,
            avg(mem_pct)::float8  AS mem_pct,
            avg(disk_pct)::float8 AS disk_pct,
            avg(swap_pct)::float8 AS swap_pct,
            avg(load1)::float8    AS load1,
            max(oom_kills)::float8 AS oom_kills,
            max(jobs)::int        AS jobs,
            avg(net_rx_bps)::float8 AS net_rx_bps,
            avg(net_tx_bps)::float8 AS net_tx_bps
       FROM samples
      WHERE machine_id = $1 AND at > now() - $2::interval
      GROUP BY 1 ORDER BY 1`,
    [id, range.interval, range.bucketS],
  );
  return NextResponse.json({ samples: rows, bucket_s: range.bucketS });
}
