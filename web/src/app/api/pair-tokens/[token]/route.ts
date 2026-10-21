import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { getOwnerKey } from "@/lib/auth";

export const runtime = "nodejs";

/** Browser polls this until the agent has paired. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ownerKey = await getOwnerKey(false);
  const pt = await one<{ owner_key: string; machine_id: string | null }>(
    `SELECT owner_key, machine_id FROM pair_tokens WHERE token = $1`,
    [token],
  );
  if (!pt || pt.owner_key !== ownerKey) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!pt.machine_id) return NextResponse.json({ paired: false });
  const m = await one<{ id: string; name: string; last_seen_at: Date | null }>(
    `SELECT id, name, last_seen_at FROM machines WHERE id = $1`,
    [pt.machine_id],
  );
  return NextResponse.json({ paired: true, machine: m, reporting: !!m?.last_seen_at });
}
