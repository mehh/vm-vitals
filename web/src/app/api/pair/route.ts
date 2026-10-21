import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { machineId, machineToken, sha256, shareSlug } from "@/lib/ids";
import { appUrl } from "@/lib/format";

export const runtime = "nodejs";

/**
 * Agent -> server. Exchanges a one-time pair token for a machine token.
 * Re-running install with the same token re-issues a token for the same
 * machine (so re-installs don't create duplicates).
 */
export async function POST(req: Request) {
  let body: { pair_token?: string; hostname?: string; os?: string; arch?: string; name?: string; agent_version?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const token = (body.pair_token ?? "").trim();
  if (!token.startsWith("pair_")) return NextResponse.json({ error: "bad pair token" }, { status: 400 });

  const pt = await one<{ token: string; owner_key: string; used_at: Date | null; machine_id: string | null; created_at: Date }>(
    `SELECT * FROM pair_tokens WHERE token = $1`,
    [token],
  );
  if (!pt) return NextResponse.json({ error: "unknown pair token. Generate a new one on the website." }, { status: 404 });

  const hostname = clean(body.hostname, 120) || "unnamed";
  const name = clean(body.name, 80) || hostname;
  const mtoken = machineToken();

  let id = pt.machine_id;
  if (id) {
    // Re-pair: rotate the token, keep history.
    await q(`UPDATE machines SET token_hash = $2, hostname = $3, os = $4, arch = $5, agent_version = $6 WHERE id = $1`, [
      id,
      sha256(mtoken),
      hostname,
      clean(body.os, 20),
      clean(body.arch, 20),
      clean(body.agent_version, 40),
    ]);
  } else {
    const ageMs = Date.now() - new Date(pt.created_at).getTime();
    if (ageMs > 24 * 3600 * 1000) {
      return NextResponse.json({ error: "pair token expired (24h). Generate a new one." }, { status: 410 });
    }
    id = machineId();
    await q(
      `INSERT INTO machines (id, name, hostname, os, arch, token_hash, owner_key, share_slug, agent_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, name, hostname, clean(body.os, 20), clean(body.arch, 20), sha256(mtoken), pt.owner_key, shareSlug(name), clean(body.agent_version, 40)],
    );
    await q(`UPDATE pair_tokens SET used_at = now(), machine_id = $2 WHERE token = $1`, [token, id]);
  }

  return NextResponse.json({
    machine_id: id,
    machine_token: mtoken,
    dashboard_url: `${appUrl()}/m/${id}`,
    interval_s: 30,
  });
}

function clean(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
  return t || null;
}
