import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { getOwnerKey } from "@/lib/auth";
import { magicToken } from "@/lib/ids";
import { sendMagicLink } from "@/lib/email";
import { appUrl } from "@/lib/format";

export const runtime = "nodejs";

/** Start the optional email claim: sends a magic link tied to this browser's machines. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { email?: string };
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return NextResponse.json({ error: "enter a valid email" }, { status: 400 });
  }
  const ownerKey = await getOwnerKey(true);
  // Light rate limit: 5 per email per hour.
  const recent = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM magic_links WHERE email = $1 AND created_at > now() - interval '1 hour'`,
    [email],
  );
  if ((recent[0]?.n ?? 0) >= 5) return NextResponse.json({ error: "too many links sent; try later" }, { status: 429 });

  const token = magicToken();
  await q(`INSERT INTO magic_links (token, email, owner_key, expires_at) VALUES ($1,$2,$3, now() + interval '30 minutes')`, [
    token,
    email,
    ownerKey,
  ]);
  const url = `${appUrl()}/auth/claim?token=${encodeURIComponent(token)}`;
  const { delivered } = await sendMagicLink(email, url);
  return NextResponse.json({ ok: true, delivered, dev_hint: delivered ? undefined : "No RESEND_API_KEY set; link printed to server log." });
}
