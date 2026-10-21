import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { getOwnerKey, setSession } from "@/lib/auth";
import { sessionToken } from "@/lib/ids";
import { appUrl } from "@/lib/format";

export const runtime = "nodejs";

/** Magic link landing. Signs in and attaches the browser's machines to the email. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const link = await one<{ email: string; owner_key: string | null; expires_at: Date; used_at: Date | null }>(
    `SELECT * FROM magic_links WHERE token = $1`,
    [token],
  );
  const home = appUrl();
  if (!link || link.used_at || new Date(link.expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(`${home}/?claim=invalid`);
  }
  await q(`UPDATE magic_links SET used_at = now() WHERE token = $1`, [token]);

  // Attach: machines created by the browser that requested the link, plus the
  // browser that clicked it (often the same one, sometimes a phone).
  const clickerKey = await getOwnerKey(true);
  const keys = [link.owner_key, clickerKey].filter(Boolean) as string[];
  if (keys.length) {
    await q(`UPDATE machines SET owner_email = $1 WHERE owner_email IS NULL AND owner_key = ANY($2::text[])`, [link.email, keys]);
  }
  await setSession(sessionToken(), link.email);
  return NextResponse.redirect(`${home}/?claim=ok`);
}
