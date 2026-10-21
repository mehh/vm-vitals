import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { getViewer, canManage } from "@/lib/auth";
import type { Incident, Machine } from "@/lib/types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string; incidentId: string }> };

async function authorize(ctx: Ctx) {
  const { id, incidentId } = await ctx.params;
  const m = await one<Machine>(`SELECT * FROM machines WHERE id = $1`, [id]);
  if (!m) return { err: NextResponse.json({ error: "not found" }, { status: 404 }) };
  const v = await getViewer();
  if (!canManage(m, v)) return { err: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  const inc = await one<Incident>(`SELECT * FROM incidents WHERE id = $1 AND machine_id = $2`, [incidentId, id]);
  if (!inc) return { err: NextResponse.json({ error: "not found" }, { status: 404 }) };
  return { inc };
}

export async function PATCH(req: Request, ctx: Ctx) {
  const a = await authorize(ctx);
  if (a.err) return a.err;
  const b = (await req.json().catch(() => ({}))) as Partial<Incident> & { resolved?: boolean };
  const inc = a.inc!;
  const title = typeof b.title === "string" && b.title.trim() ? b.title.trim().slice(0, 140) : inc.title;
  const severity = ["minor", "major", "outage"].includes(String(b.severity)) ? (b.severity as string) : inc.severity;
  const what_broke = typeof b.what_broke === "string" ? b.what_broke.trim().slice(0, 4000) || null : inc.what_broke;
  const what_fixed = typeof b.what_fixed === "string" ? b.what_fixed.trim().slice(0, 4000) || null : inc.what_fixed;
  let resolved_at: Date | null = inc.resolved_at;
  if (b.resolved === true && !resolved_at) resolved_at = new Date();
  if (b.resolved === false) resolved_at = null;
  const row = await one<Incident>(
    `UPDATE incidents SET title=$2, severity=$3, what_broke=$4, what_fixed=$5, resolved_at=$6, updated_at=now()
      WHERE id = $1 RETURNING *`,
    [inc.id, title, severity, what_broke, what_fixed, resolved_at],
  );
  return NextResponse.json({ incident: row });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const a = await authorize(ctx);
  if (a.err) return a.err;
  await q(`DELETE FROM incidents WHERE id = $1`, [a.inc!.id]);
  return NextResponse.json({ ok: true });
}
