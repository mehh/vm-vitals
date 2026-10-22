/** Tiny SVG sparkline. Server-safe; draws itself in with CSS on mount. */
export function Sparkline({
  values,
  color,
  min = 0,
  max,
  height = 36,
  fill = true,
  className = "",
}: {
  values: (number | null | undefined)[];
  color: string;
  min?: number;
  max?: number;
  height?: number;
  fill?: boolean;
  className?: string;
}) {
  const W = 100;
  const H = height;
  const pts = values.map((v, i) => (v == null || !isFinite(v) ? null : { i, v }));
  const present = pts.filter((p): p is { i: number; v: number } => p != null);
  if (present.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`block h-full w-full ${className}`} aria-hidden>
        <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke={color} strokeOpacity={0.25} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
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
  const last = present[present.length - 1];
  const id = `g${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`spark block h-full w-full ${className}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && <path className="area" d={area} fill={`url(#${id})`} />}
      <path className="line" d={d} pathLength={1} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last.i)} cy={y(last.v)} r={2.4} fill={color} vectorEffect="non-scaling-stroke" className="pulse" />
    </svg>
  );
}
