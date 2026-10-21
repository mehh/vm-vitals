import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { getViewer, canManage } from "@/lib/auth";
import { incidentId } from "@/lib/ids";
import type { Incident, Machine } from "@/lib/types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const m = await one<Machine>(`SELECT * FROM machines WHERE id = $1`, [id]);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!m.share_public) {
    const v = await getViewer();
    if (!canManage(m, v)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const incidents = await q<Incident>(`SELECT * FROM incidents WHERE machine_id = $1 ORDER BY started_at DESC LIMIT 100`, [id]);
  return NextResponse.json({ incidents });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const m = await one<Machine>(`SELECT * FROM machines WHERE id = $1`, [id]);
  if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
  const v = await getViewer();
  if (!canManage(m, v)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Partial<Incident> & { resolved?: boolean };
  const title = String(b.title ?? "").trim().slice(0, 140);
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const severity = ["minor", "major", "outage"].includes(String(b.severity)) ? b.severity : "minor";
  const row = await one<Incident>(
    `INSERT INTO incidents (id, machine_id, title, what_broke, what_fixed, severity, started_at, resolved_at)
     VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7::timestamptz, now()), $8::timestamptz) RETURNING *`,
    [
      incidentId(),
      id,
      title,
      text(b.what_broke),
      text(b.what_fixed),
      severity,
      b.started_at ? new Date(b.started_at as unknown as string) : null,
      b.resolved || b.what_fixed ? new Date() : null,
    ],
  );
  return NextResponse.json({ incident: row }, { status: 201 });
}

function text(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().slice(0, 4000);
  return t || null;
}
