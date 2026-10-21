import "server-only";
import { cookies } from "next/headers";
import { q, one } from "./db";
import { ownerKey as newOwnerKey, sha256 } from "./ids";
import type { Machine } from "./types";

export const OWNER_COOKIE = "vv_owner";
export const SESSION_COOKIE = "vv_session";
const YEAR = 60 * 60 * 24 * 365;

/** The browser's anonymous owner key, creating one if missing. */
export async function getOwnerKey(create = false): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(OWNER_COOKIE)?.value ?? null;
  if (existing || !create) return existing;
  const key = newOwnerKey();
  jar.set(OWNER_COOKIE, key, { httpOnly: true, sameSite: "lax", secure: isProd(), path: "/", maxAge: YEAR });
  return key;
}

export async function getSessionEmail(): Promise<string | null> {
  const jar = await cookies();
  const tok = jar.get(SESSION_COOKIE)?.value;
  if (!tok) return null;
  const row = await one<{ email: string }>(
    `SELECT email FROM sessions WHERE token_hash = $1 AND expires_at > now()`,
    [sha256(tok)],
  );
  return row?.email ?? null;
}

export async function setSession(token: string, email: string) {
  await q(`INSERT INTO sessions (token_hash, email, expires_at) VALUES ($1,$2, now() + interval '90 days')`, [
    sha256(token),
    email,
  ]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: isProd(), path: "/", maxAge: 90 * 86400 });
}

export async function clearSession() {
  const jar = await cookies();
  const tok = jar.get(SESSION_COOKIE)?.value;
  if (tok) await q(`DELETE FROM sessions WHERE token_hash = $1`, [sha256(tok)]);
  jar.delete(SESSION_COOKIE);
}

export interface Viewer {
  ownerKey: string | null;
  email: string | null;
}

export async function getViewer(): Promise<Viewer> {
  const [ownerKey, email] = await Promise.all([getOwnerKey(false), getSessionEmail()]);
  return { ownerKey, email };
}

export function canManage(m: Pick<Machine, "owner_key" | "owner_email">, v: Viewer): boolean {
  if (v.ownerKey && v.ownerKey === m.owner_key) return true;
  if (v.email && m.owner_email && v.email.toLowerCase() === m.owner_email.toLowerCase()) return true;
  return false;
}

/** All machines this viewer can manage. */
export async function myMachines(v: Viewer): Promise<Machine[]> {
  if (!v.ownerKey && !v.email) return [];
  return q<Machine>(
    `SELECT * FROM machines
      WHERE ($1::text IS NOT NULL AND owner_key = $1)
         OR ($2::text IS NOT NULL AND lower(owner_email) = lower($2))
      ORDER BY created_at DESC`,
    [v.ownerKey, v.email],
  );
}

function isProd() {
  return process.env.NODE_ENV === "production";
}
