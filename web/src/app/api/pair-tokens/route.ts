import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { pairToken } from "@/lib/ids";
import { getOwnerKey } from "@/lib/auth";
import { appUrl } from "@/lib/format";
import { botPrompt, installCommand } from "@/lib/prompt";

export const runtime = "nodejs";

/** Browser -> server. Mints a pair token tied to this browser's owner cookie. */
export async function POST() {
  const ownerKey = (await getOwnerKey(true))!;
  const token = pairToken();
  await q(`INSERT INTO pair_tokens (token, owner_key) VALUES ($1,$2)`, [token, ownerKey]);
  const host = appUrl();
  return NextResponse.json({
    token,
    host,
    command: installCommand(host, token),
    sudo_command: installCommand(host, token, true),
    prompt: botPrompt({ host, token }),
  });
}
