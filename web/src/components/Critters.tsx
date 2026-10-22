/**
 * Grok Bot and its agent friends, as plain SVG. No hooks and no client code,
 * so the same drawings render in pages and in next/og images. Animation is
 * CSS (classes cr-*) and simply doesn't run inside OG images.
 *
 * Grok Bot reflects the machine's overall mood. Each friend watches one
 * metric and fills up like a jar as that number climbs: Chip (CPU), Mimi
 * (memory), Stash (disk), Ping (network).
 */
import type { MoodKey } from "@/lib/vitals";

export type Kind = "grok" | "chip" | "mem" | "disk" | "net";
export type Expr = "happy" | "calm" | "busy" | "sweaty" | "panic" | "asleep" | "curious" | "dead";

export const INK = "#000000";
export const PAPER = "#ffffff";
export const STATUS = { ok: "#34d399", warn: "#fbbf24", bad: "#f87171", dim: "#5a5a5a", muted: "#8a8a8a" };

export const CREW: Record<Exclude<Kind, "grok">, { name: string; watches: string; sweats: string }> = {
  chip: { name: "Chip", watches: "CPU and load", sweats: "Sweats past 85%. Panics at 95." },
  mem: { name: "Mimi", watches: "Memory and swap", sweats: "Gets nervous when the OOM killer is in the building." },
  disk: { name: "Stash", watches: "The root disk", sweats: "Fills up like a jar. Hates being full." },
  net: { name: "Ping", watches: "Bytes in and out", sweats: "Bounces when the pipes are busy." },
};

/** Face for a friend at a given level. */
export function exprFor(level: number | null | undefined, opts: { offline?: boolean; noData?: boolean } = {}): Expr {
  if (opts.offline) return "asleep";
  if (opts.noData || level == null) return "curious";
  if (level >= 95) return "panic";
  if (level >= 85) return "sweaty";
  if (level >= 60) return "busy";
  if (level < 25) return "happy";
  return "calm";
}

/** Grok Bot's face for the machine's mood. */
export function grokExpr(mood: MoodKey): Expr {
  return ({ thriving: "happy", humming: "calm", sweating: "sweaty", wheezing: "panic", flatlining: "dead", ghosted: "asleep", waiting: "curious" } as const)[mood];
}

export function moodHex(mood: MoodKey): string {
  if (mood === "thriving" || mood === "humming") return STATUS.ok;
  if (mood === "sweating" || mood === "wheezing") return STATUS.warn;
  if (mood === "flatlining") return STATUS.bad;
  return STATUS.dim;
}

export function levelHex(level: number | null | undefined): string {
  if (level == null) return PAPER;
  if (level >= 95) return STATUS.bad;
  if (level >= 85) return STATUS.warn;
  return PAPER;
}

interface Geo {
  body: (fill: string, stroke: string) => React.ReactNode;
  clip: React.ReactNode; // body shape, used to clip the liquid
  extras?: (c: string) => React.ReactNode;
  eyes: [number, number, number]; // left x, right x, y
  mouth: [number, number];
  top: number;
  bottom: number;
}

const SW = 4.5;

const GEO: Record<Exclude<Kind, "grok">, Geo> = {
  chip: {
    body: (f, s) => <rect x={24} y={28} width={52} height={52} rx={12} fill={f} stroke={s} strokeWidth={SW} />,
    clip: <rect x={24} y={28} width={52} height={52} rx={12} />,
    extras: (c) => (
      <g fill={c}>
        {[38, 51, 64].map((y) => (
          <g key={y}>
            <rect x={13} y={y - 2.5} width={9} height={5} rx={2.5} />
            <rect x={78} y={y - 2.5} width={9} height={5} rx={2.5} />
          </g>
        ))}
        {[38, 50, 62].map((x) => (
          <rect key={x} x={x - 2.5} y={16} width={5} height={10} rx={2.5} />
        ))}
      </g>
    ),
    eyes: [40, 60, 50],
    mouth: [50, 66],
    top: 30,
    bottom: 80,
  },
  mem: {
    body: (f, s) => <rect x={14} y={32} width={72} height={46} rx={14} fill={f} stroke={s} strokeWidth={SW} />,
    clip: <rect x={14} y={32} width={72} height={46} rx={14} />,
    extras: (c) => (
      <g fill={c}>
        {[24, 34, 44, 56, 66].map((x) => (
          <rect key={x} x={x} y={82} width={6} height={9} rx={1.5} />
        ))}
        <rect x={44} y={22} width={12} height={8} rx={3} />
      </g>
    ),
    eyes: [38, 62, 52],
    mouth: [50, 66],
    top: 33,
    bottom: 78,
  },
  disk: {
    body: (f, s) => <path d="M18 34 C18 22 82 22 82 34 L82 80 C82 93 18 93 18 80 Z" fill={f} stroke={s} strokeWidth={SW} strokeLinejoin="round" />,
    clip: <path d="M18 34 C18 22 82 22 82 34 L82 80 C82 93 18 93 18 80 Z" />,
    extras: (c) => <path d="M18 34 C18 45 82 45 82 34" fill="none" stroke={c} strokeWidth={SW} strokeLinecap="round" />,
    eyes: [38, 62, 60],
    mouth: [50, 74],
    top: 30,
    bottom: 90,
  },
  net: {
    body: (f, s) => <path d="M50 32 C72 32 86 48 84 66 C82 82 68 91 50 91 C32 91 18 82 16 66 C14 48 28 32 50 32 Z" fill={f} stroke={s} strokeWidth={SW} strokeLinejoin="round" />,
    clip: <path d="M50 32 C72 32 86 48 84 66 C82 82 68 91 50 91 C32 91 18 82 16 66 C14 48 28 32 50 32 Z" />,
    extras: (c) => (
      <g fill="none" stroke={c} strokeWidth={SW} strokeLinecap="round" className="cr-top">
        <path d="M33 20 Q50 6 67 20" />
        <path d="M41 26 Q50 18 59 26" />
      </g>
    ),
    eyes: [38, 62, 60],
    mouth: [50, 74],
    top: 34,
    bottom: 91,
  },
};

function Eyes({ expr, l, r, y, c, k = 1 }: { expr: Expr; l: number; r: number; y: number; c: string; k?: number }) {
  const s = { stroke: c, strokeWidth: 4 * k, strokeLinecap: "round" as const, fill: "none" };
  const pair = (draw: (x: number, side: -1 | 1) => React.ReactNode) => (
    <>
      {draw(l, -1)}
      {draw(r, 1)}
    </>
  );
  switch (expr) {
    case "happy":
      return pair((x) => <path key={x} d={`M${x - 6 * k} ${y + 2 * k} Q${x} ${y - 7 * k} ${x + 6 * k} ${y + 2 * k}`} {...s} />);
    case "asleep":
      return pair((x) => <path key={x} d={`M${x - 6 * k} ${y - 1 * k} Q${x} ${y + 6 * k} ${x + 6 * k} ${y - 1 * k}`} {...s} />);
    case "busy":
      return pair((x, side) => (
        <g key={x}>
          <rect x={x - 3.5 * k} y={y - 5 * k} width={7 * k} height={11 * k} rx={3.5 * k} fill={c} />
          <path d={`M${x - 7 * k * -side} ${y - 11 * k} L${x + 6 * k * -side} ${y - 8 * k}`} {...s} strokeWidth={3 * k} />
        </g>
      ));
    case "panic":
      return pair((x, side) => <path key={x} d={`M${x - 5 * k * side} ${y - 6 * k} L${x + 5 * k * side} ${y} L${x - 5 * k * side} ${y + 6 * k}`} {...s} strokeLinejoin="round" />);
    case "dead":
      return pair((x) => <path key={x} d={`M${x - 5 * k} ${y - 5 * k} L${x + 5 * k} ${y + 5 * k} M${x + 5 * k} ${y - 5 * k} L${x - 5 * k} ${y + 5 * k}`} {...s} />);
    case "curious":
      return (
        <>
          <circle cx={l} cy={y} r={5 * k} fill={c} />
          <circle cx={r} cy={y} r={6.5 * k} fill={c} />
          <path d={`M${r - 7 * k} ${y - 12 * k} Q${r} ${y - 16 * k} ${r + 7 * k} ${y - 11 * k}`} {...s} strokeWidth={3 * k} />
        </>
      );
    case "sweaty":
      return pair((x) => <circle key={x} cx={x} cy={y} r={4.5 * k} fill={c} />);
    default:
      return pair((x) => <circle key={x} cx={x} cy={y} r={5.5 * k} fill={c} />);
  }
}

function Mouth({ expr, x, y, c, k = 1 }: { expr: Expr; x: number; y: number; c: string; k?: number }) {
  const s = { stroke: c, strokeWidth: 3.5 * k, strokeLinecap: "round" as const, fill: "none" };
  switch (expr) {
    case "happy":
      return <path d={`M${x - 8 * k} ${y - 2 * k} Q${x} ${y + 7 * k} ${x + 8 * k} ${y - 2 * k}`} {...s} />;
    case "calm":
      return <path d={`M${x - 5 * k} ${y} Q${x} ${y + 4 * k} ${x + 5 * k} ${y}`} {...s} />;
    case "busy":
    case "dead":
      return <path d={`M${x - 6 * k} ${y + 1} L${x + 6 * k} ${y + 1}`} {...s} />;
    case "sweaty":
      return <path d={`M${x - 8 * k} ${y + 1} q${2 * k} ${-3 * k} ${4 * k} 0 t${4 * k} 0 t${4 * k} 0 t${4 * k} 0`} {...s} />;
    case "panic":
      return <ellipse cx={x} cy={y + 1} rx={4.5 * k} ry={5.5 * k} fill={c} />;
    case "asleep":
      return <circle cx={x} cy={y + 1} r={2.5 * k} fill={c} />;
    case "curious":
      return <circle cx={x + 3 * k} cy={y + 1} r={2.8 * k} fill={c} />;
  }
}

function SweatDrop({ x, y, c }: { x: number; y: number; c: string }) {
  return <path className="cr-drop" d={`M${x} ${y} C${x + 4} ${y + 6} ${x + 5} ${y + 9} ${x} ${y + 12} C${x - 5} ${y + 9} ${x - 4} ${y + 6} ${x} ${y} Z`} fill={c} stroke={INK} strokeWidth={1.5} />;
}

function Zzz({ x, y, c }: { x: number; y: number; c: string }) {
  const z = (dx: number, dy: number, s: number, cls: string) => (
    <path className={cls} d={`M${x + dx} ${y + dy} h${s} l${-s} ${s} h${s}`} fill="none" stroke={c} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  );
  return (
    <g>
      {z(0, 6, 6, "cr-z cr-z1")}
      {z(8, -4, 8, "cr-z cr-z2")}
    </g>
  );
}

export interface CritterProps {
  kind: Kind;
  /** Unique per page; used for clip-path ids. */
  id: string;
  expr: Expr;
  /** 0..100 fill for friends. Ignored for Grok Bot. */
  level?: number | null;
  /** Grok Bot antenna light. */
  light?: string;
  size?: number;
  /** Seconds to offset the idle loop so a row of critters doesn't move in lockstep. */
  delay?: number;
  label?: string;
  className?: string;
  /** Background behind the outline friends. */
  ground?: string;
  /** Liquid color override for friends. */
  liquid?: string;
  /** Seconds per antenna pulse for Grok Bot (its heartbeat). */
  beat?: number;
}

export function Critter({ kind, id, expr, level, light = STATUS.ok, size = 96, delay = 0, label, className = "", ground = INK, liquid: liquidOverride, beat }: CritterProps) {
  const dim = expr === "asleep";
  const paper = dim ? STATUS.dim : PAPER;
  const style = { ["--cr-delay" as string]: `${delay}s`, ...(beat ? { ["--beat" as string]: `${beat}s` } : {}) } as React.CSSProperties;
  const aria = label ?? (kind === "grok" ? "Grok Bot" : CREW[kind].name);

  if (kind === "grok") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} className={`cr cr-${expr} ${className}`} style={style} role="img" aria-label={aria}>
        <g className="cr-all">
          <g fill={paper}>
            <rect x={30} y={84} width={14} height={10} rx={5} />
            <rect x={56} y={84} width={14} height={10} rx={5} />
            <rect x={8} y={44} width={8} height={22} rx={4} />
            <rect x={84} y={44} width={8} height={22} rx={4} />
          </g>
          <g className="cr-top">
            <path d="M50 27 L50 13" stroke={paper} strokeWidth={SW} strokeLinecap="round" />
            <circle className="cr-light" cx={50} cy={9} r={6} fill={dim ? STATUS.dim : light} stroke={INK} strokeWidth={2} />
          </g>
          <rect x={15} y={25} width={70} height={62} rx={24} fill={paper} />
          <rect x={23} y={39} width={54} height={28} rx={14} fill={INK} />
          <g className="cr-eyes">
            <Eyes expr={expr} l={39} r={61} y={53} c={dim ? STATUS.muted : PAPER} k={0.85} />
          </g>
          <g className="cr-face">
            <Mouth expr={expr} x={50} y={76} c={INK} k={0.9} />
          </g>
          {(expr === "sweaty" || expr === "panic") && <SweatDrop x={84} y={18} c={PAPER} />}
          {dim && <Zzz x={78} y={6} c={STATUS.muted} />}
        </g>
      </svg>
    );
  }

  const g = GEO[kind];
  const p = Math.max(0, Math.min(100, level ?? 0));
  const ly = g.bottom - ((g.bottom - g.top) * p) / 100;
  const liquid = dim ? STATUS.dim : (liquidOverride ?? levelHex(level));
  const [el, er, ey] = g.eyes;
  const [mx, my] = g.mouth;
  const clipBody = `${id}-body`;
  const clipBelow = `${id}-below`;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} className={`cr cr-${expr} ${className}`} style={style} role="img" aria-label={aria}>
      <defs>
        <clipPath id={clipBody}>{g.clip}</clipPath>
        <clipPath id={clipBelow}>
          <rect x={0} y={ly} width={100} height={100} />
        </clipPath>
      </defs>
      <g className="cr-all">
        {g.extras?.(paper)}
        {g.body(ground, paper)}
        {p > 0 && (
          <g clipPath={`url(#${clipBody})`}>
            <path className="cr-wave" d={`M-50 ${ly} q6.25 -3 12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 V100 H-50 Z`} fill={liquid} />
          </g>
        )}
        {g.body("none", paper)}
        <g className="cr-eyes">
          <Eyes expr={expr} l={el} r={er} y={ey} c={paper} />
          <g clipPath={`url(#${clipBelow})`}>
            <Eyes expr={expr} l={el} r={er} y={ey} c={INK} />
          </g>
        </g>
        <g className="cr-face">
          <Mouth expr={expr} x={mx} y={my} c={paper} />
          <g clipPath={`url(#${clipBelow})`}>
            <Mouth expr={expr} x={mx} y={my} c={INK} />
          </g>
        </g>
        {(expr === "sweaty" || expr === "panic") && <SweatDrop x={86} y={20} c={PAPER} />}
        {dim && <Zzz x={76} y={10} c={STATUS.muted} />}
      </g>
    </svg>
  );
}
