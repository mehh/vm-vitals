/**
 * An EKG strip that scrolls forever. Speed follows bpm. Server-safe.
 * The waveform repeats twice so the loop has no seam.
 */
const BEAT = "0,20 10,20 14,20 17,14 20,26 23,20 28,20 31,2 35,38 39,20 48,20 52,16 56,20 70,20";

export function Heartbeat({ bpm = 70, color = "var(--good)", height = 44, className = "" }: { bpm?: number; color?: string; height?: number; className?: string }) {
  const beats = 4;
  const seconds = bpm > 0 ? (60 / bpm) * beats : 0;
  const W = 70 * beats;
  const copies = [0, 1];
  return (
    <div className={`ekg w-full ${className}`} style={{ height, ["--ekg" as string]: seconds ? `${seconds}s` : "0s" }} aria-hidden>
      <svg viewBox={`0 0 ${W * 2} 40`} preserveAspectRatio="none" className="h-full" style={{ width: "200%" }}>
        <g className="track" style={seconds ? undefined : { animation: "none" }}>
          {copies.map((c) =>
            Array.from({ length: beats }, (_, b) => (
              <polyline
                key={`${c}-${b}`}
                points={BEAT}
                transform={`translate(${c * W + b * 70} 0)`}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: `drop-shadow(0 0 4px ${color})` }}
              />
            )),
          )}
        </g>
      </svg>
    </div>
  );
}
