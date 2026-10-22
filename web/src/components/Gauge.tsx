/** 270° ring gauge. Server-safe; the arc eases to new values via CSS. */
export function Gauge({
  pct,
  color,
  size = 96,
  stroke = 9,
  children,
  className = "",
}: {
  pct: number | null | undefined;
  color: string;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const p = Math.max(0, Math.min(100, pct ?? 0)) / 100;
  const r = 50 - stroke / 2;
  const C = 2 * Math.PI * r;
  const arc = 0.75 * C;
  return (
    <div className={`relative inline-grid place-items-center ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="gauge absolute inset-0 h-full w-full" style={{ transform: "rotate(135deg)" }} aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} strokeDasharray={`${arc} ${C}`} strokeLinecap="round" />
        <circle
          className="value"
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${Math.max(0.001, arc * p)} ${C}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="relative z-10 text-center leading-none">{children}</div>
    </div>
  );
}
