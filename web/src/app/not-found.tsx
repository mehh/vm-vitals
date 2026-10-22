import Link from "next/link";
import { Heartbeat } from "@/components/Heartbeat";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="text-5xl" aria-hidden>
        🫥
      </div>
      <h1 className="mt-4 text-2xl font-semibold">No pulse here</h1>
      <p className="mt-2 text-secondary">That machine or page doesn&apos;t exist, or its owner turned sharing off. Either way, flat line.</p>
      <div className="mx-auto mt-6 max-w-xs opacity-60">
        <Heartbeat bpm={0} color="var(--text-muted)" height={40} />
      </div>
      <Link href="/" className="btn btn-primary mt-6">
        Back to the living
      </Link>
    </div>
  );
}
