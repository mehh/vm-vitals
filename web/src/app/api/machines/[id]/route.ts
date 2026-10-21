import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { getViewer, canManage } from "@/lib/auth";
import { reconcileOffline } from "@/lib/alerts";
import { OFFLINE_AFTER_MS, type Alert, type Machine } from "@/lib/types";
import { healthOf } from "@/lib/format";
import { publicMachine } from "@/lib/machines";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Live snapshot for the dashboard poller. Owner-only. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const m = await one<Machine>(`SELECT * FROM machines WHERE id = $1`, [id]);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  const v = await getViewer();
  if (!canManage(m, v)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const offline = await reconcileOffline(m.id, m.last_seen_at, OFFLINE_AFTER_MS);
  const alerts = await q<Alert>(
    `SELECT * FROM alerts WHERE machine_id = $1 ORDER BY (resolved_at IS NULL) DESC, opened_at DESC LIMIT 50`,
    [m.id],
  );
  const open = alerts.filter((a) => !a.resolved_at);
  return NextResponse.json({
    machine: publicMachine(m),
    report: m.last_report,
    offline,
    health: healthOf({ offline, severities: open.map((a) => a.severity) }),
    alerts,
  });
}

/** Rename, toggle public share. Owner-only. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const m = await one<Machine>(`SELECT * FROM machines WHERE id = $1`, [id]);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  const v = await getViewer();
  if (!canManage(m, v)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { name?: string; share_public?: boolean };
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 80);
    if (name) await q(`UPDATE machines SET name = $2 WHERE id = $1`, [id, name]);
  }
  if (typeof body.share_public === "boolean") {
    await q(`UPDATE machines SET share_public = $2 WHERE id = $1`, [id, body.share_public]);
  }
  const updated = await one<Machine>(`SELECT * FROM machines WHERE id = $1`, [id]);
  return NextResponse.json({ machine: publicMachine(updated!) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const m = await one<Machine>(`SELECT * FROM machines WHERE id = $1`, [id]);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  const v = await getViewer();
  if (!canManage(m, v)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await q(`DELETE FROM machines WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
