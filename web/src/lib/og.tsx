/**
 * Social cards (1200x630) drawn with next/og. Same critters as the pages,
 * same 1-bit look. Server only: reads the Geist Mono TTFs from assets/.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { Fragment, isValidElement, type ReactNode } from "react";
import { Critter, STATUS, grokExpr, moodHex, type CritterProps } from "@/components/Critters";
import type { Friend } from "./crew";
import type { MoodKey } from "./vitals";

export const OG_SIZE = { width: 1200, height: 630 };

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 800; style: "normal" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all(
    [
      ["GeistMono-Regular.ttf", 400],
      ["GeistMono-ExtraBold.ttf", 800],
    ].map(async ([file, weight]) => ({
      name: "Geist Mono",
      data: await readFile(path.join(process.cwd(), "assets/fonts", file as string)),
      weight: weight as 400 | 800,
      style: "normal" as const,
    })),
  );
  return fonts;
}

/** Satori only takes plain SVG elements, so critters go in as data-URI images. */
function Img(props: CritterProps) {
  const size = props.size ?? 96;
  const svg = toSvg(<Critter {...props} />);
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" width={size} height={size} src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} />;
}

const KEEP_CASE = new Set(["viewBox"]);
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Minimal static SVG serializer: calls function components, drops fragments, styles and classes. */
function toSvg(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return esc(String(node));
  if (Array.isArray(node)) return node.map(toSvg).join("");
  if (!isValidElement(node)) return "";
  const { type, props } = node as { type: unknown; props: Record<string, unknown> & { children?: ReactNode } };
  if (type === Fragment) return toSvg(props.children);
  if (typeof type === "function") return toSvg((type as (p: unknown) => ReactNode)(props));
  let attrs = "";
  for (const [k, v] of Object.entries(props)) {
    if (k === "children" || k === "style" || k === "className" || v == null || v === false) continue;
    const name = KEEP_CASE.has(k) ? k : k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    attrs += ` ${name}="${esc(String(v))}"`;
  }
  return `<${type as string}${attrs}>${toSvg(props.children)}</${type as string}>`;
}

const C = { bg: "#000", fg: "#fff", fg2: "#d4d4d4", muted: "#8a8a8a", dim: "#5a5a5a", line: "#262626" };
const FRIEND_NAME = { chip: "chip", mem: "mimi", disk: "stash", net: "ping" } as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: C.bg,
        color: C.fg,
        fontFamily: "Geist Mono",
        padding: "48px 56px",
        backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 0), linear-gradient(rgba(255,255,255,0.05) 1px, transparent 0)",
        backgroundSize: "48px 48px",
      }}
    >
      {children}
    </div>
  );
}

export interface ShareCardData {
  id: string;
  name: string;
  mood: { key: MoodKey; label: string; quip: string };
  score: number | null;
  sub: string;
  crew: Friend[];
  cpu: number[];
  host: string;
}

export async function shareCard(d: ShareCardData) {
  const light = moodHex(d.mood.key);
  const W = 520;
  const H = 64;
  const path =
    d.cpu.length >= 2
      ? d.cpu.map((v, i) => `${i === 0 ? "M" : "L"}${((i / (d.cpu.length - 1)) * W).toFixed(1)} ${(H - 3 - (Math.min(100, Math.max(0, v)) / 100) * (H - 6)).toFixed(1)}`).join(" ")
      : "";
  const scoreColor = d.score == null ? C.dim : d.score < 55 ? STATUS.bad : d.score < 75 ? STATUS.warn : C.fg;

  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: C.muted }}>
          <div style={{ display: "flex", color: C.fg, fontWeight: 800 }}>vm-vitals</div>
          <div style={{ display: "flex" }}>my AI&apos;s computer, live</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", marginTop: 26 }}>
          <div style={{ display: "flex", width: 210, height: 210 }}>
            <Img kind="grok" id={`og-${d.id}`} expr={grokExpr(d.mood.key)} light={light} size={210} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 34, minWidth: 0 }}>
            <div style={{ display: "flex", fontSize: d.name.length > 18 ? 46 : 60, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>{d.name}</div>
            <div style={{ display: "flex", alignItems: "center", marginTop: 16, fontSize: 30, fontWeight: 800 }}>
              <div style={{ display: "flex", width: 16, height: 16, borderRadius: 8, background: light, marginRight: 14 }} />
              {d.mood.label.toLowerCase()}
            </div>
            <div style={{ display: "flex", marginTop: 10, fontSize: 20, color: C.muted }}>{d.sub}</div>
            {path ? (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 18 }}>
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                  <path d={path} fill="none" stroke={C.fg} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
                </svg>
                <div style={{ display: "flex", fontSize: 15, color: C.dim, marginTop: 4, letterSpacing: 2 }}>CPU · LAST HOUR</div>
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 168, fontWeight: 800, letterSpacing: -10, lineHeight: 0.9, color: scoreColor }}>{d.score == null ? "–" : d.score}</div>
            <div style={{ display: "flex", fontSize: 18, color: C.muted, letterSpacing: 3, marginTop: 8 }}>HEALTH / 100</div>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: "auto", borderTop: `1px solid ${C.line}`, paddingTop: 22 }}>
          {d.crew.map((f) => (
            <div key={f.kind} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", width: 76, height: 76 }}>
                <Img kind={f.kind} id={`og-${d.id}-${f.kind}`} level={f.level} expr={f.expr} liquid={f.liquid} size={76} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", marginLeft: 14 }}>
                <div style={{ display: "flex", fontSize: 15, color: C.muted, letterSpacing: 2 }}>
                  {FRIEND_NAME[f.kind].toUpperCase()} · {f.label.toUpperCase()}
                </div>
                <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: f.level != null && f.kind !== "net" && f.level >= 85 ? (f.level >= 95 ? STATUS.bad : STATUS.warn) : C.fg }}>{f.value}</div>
              </div>
            </div>
          ))}
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}

export async function homeCard(host: string) {
  const crew = [
    { kind: "chip", level: 34, expr: "calm" },
    { kind: "mem", level: 66, expr: "busy" },
    { kind: "disk", level: 88, expr: "sweaty" },
    { kind: "net", level: 45, expr: "happy" },
  ] as const;
  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: C.muted }}>
          <div style={{ display: "flex", color: C.fg, fontWeight: 800 }}>vm-vitals</div>
          <div style={{ display: "flex" }}>open source · free</div>
        </div>
        <div style={{ display: "flex", fontSize: 20, color: C.muted, marginTop: 40 }}>$ grok-bot install vm-vitals --watch-my-vitals</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 88, fontWeight: 800, letterSpacing: -5, lineHeight: 0.95, marginTop: 18 }}>
          <div style={{ display: "flex" }}>is my bot&apos;s</div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            computer okay?
            <div style={{ display: "flex", width: 40, height: 66, background: C.fg, marginLeft: 12, marginBottom: 8 }} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 22, color: C.fg2 }}>
            <div style={{ display: "flex" }}>One prompt to your Grok Bot.</div>
            <div style={{ display: "flex" }}>A live heartbeat for its computer.</div>
            <div style={{ display: "flex", color: C.muted, marginTop: 10 }}>{host.replace(/^https?:\/\//, "")}</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            {crew.map((f, i) => (
              <div key={f.kind} style={{ display: "flex", width: 92, height: 92, marginRight: 6, marginBottom: i % 2 ? 0 : 10 }}>
                <Img kind={f.kind} id={`home-${f.kind}`} level={f.level} expr={f.expr} liquid={f.kind === "net" ? "#ffffff" : undefined} size={92} />
              </div>
            ))}
            <div style={{ display: "flex", width: 200, height: 200, marginLeft: 8 }}>
              <Img kind="grok" id="home-grok" expr="happy" size={200} />
            </div>
          </div>
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
