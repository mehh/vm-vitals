import type { Health } from "@/lib/format";
import { HEALTH_LABEL } from "@/lib/format";

export function meterColor(p: number | null | undefined) {
  if (p == null) return "var(--text-muted)";
  if (p >= 95) return "var(--bad)";
  if (p >= 85) return "var(--warn)";
  return "var(--fg)";
}

export function Meter({ pct }: { pct: number | null | undefined }) {
  const p = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="meter" role="meter" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${p}%`, background: meterColor(pct) }} />
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  pct,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  pct?: number | null;
  color?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
        {color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
      </div>
      <div className="mono mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-secondary">{sub}</div>}
      {pct != null && (
        <div className="mt-3">
          <Meter pct={pct} />
        </div>
      )}
    </div>
  );
}

const HEALTH_CLASS: Record<Health, string> = {
  ok: "text-ok border-ok/40",
  warning: "text-warn border-warn/40",
  critical: "text-bad border-bad/40",
  offline: "text-muted border-line-strong",
};

const HEALTH_ICON: Record<Health, string> = { ok: "●", warning: "▲", critical: "✖", offline: "○" };

export function HealthBadge({ health, big = false }: { health: Health; big?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border uppercase tracking-[0.12em] ${HEALTH_CLASS[health]} ${big ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]"}`}
    >
      <span aria-hidden className={health === "ok" ? "pulse" : ""}>
        {HEALTH_ICON[health]}
      </span>
      {HEALTH_LABEL[health]}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: string }) {
  const c = severity === "critical" || severity === "outage" ? "bg-critical" : severity === "warning" || severity === "major" ? "bg-warning" : "bg-info";
  return <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${c}`} aria-label={severity} />;
}
