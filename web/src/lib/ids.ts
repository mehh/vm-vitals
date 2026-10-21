import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o/1/l

export function randomId(len = 10): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function machineId() {
  return "m_" + randomId(10);
}

export function pairToken() {
  return "pair_" + randomId(24);
}

export function machineToken() {
  return "mvt_" + randomBytes(32).toString("base64url");
}

export function ownerKey() {
  return "own_" + randomBytes(24).toString("base64url");
}

export function sessionToken() {
  return "sess_" + randomBytes(32).toString("base64url");
}

export function magicToken() {
  return randomBytes(24).toString("base64url");
}

export function incidentId() {
  return "inc_" + randomId(8);
}

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

/** URL-safe share slug from a machine name plus a short random suffix. */
export function shareSlug(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return (base || "machine") + "-" + randomId(5);
}
