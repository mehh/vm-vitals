/** Shared, client-safe formatting helpers. */

export function bytes(n: number | null | undefined, digits = 1): string {
  if (n == null || !isFinite(n)) return "–";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
}

export function pct(n: number | null | undefined): string {
  return n == null ? "–" : `${Math.round(n)}%`;
}

export function duration(s: number | null | undefined): string {
  if (s == null) return "–";
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

export function ago(d: Date | string | null | undefined, now = Date.now()): string {
  if (!d) return "never";
  const t = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function osLabel(os: string | null | undefined): string {
  return os === "darwin" ? "macOS" : os === "linux" ? "Linux" : os ?? "?";
}

/** Status roll-up used by cards, share page and OG image. */
export type Health = "ok" | "warning" | "critical" | "offline";

export function healthOf(opts: { offline: boolean; severities: string[] }): Health {
  if (opts.offline) return "offline";
  if (opts.severities.includes("critical")) return "critical";
  if (opts.severities.includes("warning")) return "warning";
  return "ok";
}

export const HEALTH_LABEL: Record<Health, string> = {
  ok: "All good",
  warning: "Needs attention",
  critical: "Critical",
  offline: "Offline",
};
