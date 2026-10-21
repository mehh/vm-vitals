import type { Machine } from "./types";

/** Fields of a machine that are safe to send to the owner's browser. */
export function publicMachine(m: Machine) {
  return {
    id: m.id,
    name: m.name,
    hostname: m.hostname,
    os: m.os,
    arch: m.arch,
    share_slug: m.share_slug,
    share_public: m.share_public,
    created_at: m.created_at,
    last_seen_at: m.last_seen_at,
    agent_version: m.agent_version,
    claimed: !!m.owner_email,
  };
}
export type PublicMachine = ReturnType<typeof publicMachine>;
