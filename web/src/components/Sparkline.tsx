/** Tiny SVG sparkline. Server-safe. */
export function Sparkline({
  values,
  color = "#ffffff",
  min = 0,
  max,
  height = 36,
  className = "",
}: {
  values: (number | null | undefined)[];
  color?: string;
  min?: number;
  max?: number;
  height?: number;
  className?: string;
}) {
  const W = 100;
  const H = height;
  const pts = values.map((v, i) => (v == null || !isFinite(v) ? null : { i, v }));
  const present = pts.filter((p): p is { i: number; v: number } => p != null);
  if (present.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`block h-full w-full ${className}`} aria-hidden>
        <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke="var(--dim)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const hi = max ?? Math.max(1e-9, ...present.map((p) => p.v)) * 1.08;
  const span = Math.max(1e-9, hi - min);
  const n = Math.max(1, values.length - 1);
  const x = (i: number) => (i / n) * W;
  const y = (v: number) => H - 2 - ((Math.min(hi, Math.max(min, v)) - min) / span) * (H - 4);
  const d = present.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(2)} ${y(p.v).toFixed(2)}`).join(" ");
  const area = `${d} L${x(present[present.length - 1].i).toFixed(2)} ${H} L${x(present[0].i).toFixed(2)} ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`spark block h-full w-full ${className}`} aria-hidden>
      <path d={area} fill={color} fillOpacity={0.07} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
