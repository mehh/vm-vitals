import Link from "next/link";
import { Critter } from "@/components/Critters";
import { Heartbeat } from "@/components/Heartbeat";

export default function NotFound() {
  return (
    <div className="wrap flex flex-col items-center py-24 text-center">
      <Critter kind="grok" id="nf" expr="asleep" size={140} />
      <div className="kicker mt-8">404</div>
      <h1 className="display mt-3 text-5xl sm:text-6xl">no pulse here.</h1>
      <p className="mt-4 max-w-md text-sm text-fg-2">That machine or page doesn&apos;t exist, or its owner turned sharing off. Grok Bot checked twice and went back to sleep.</p>
      <div className="mt-8 w-full max-w-xs">
        <Heartbeat bpm={0} color="var(--dim)" height={36} />
      </div>
      <Link href="/" className="btn btn-primary mt-8">
        Back to the living
      </Link>
    </div>
  );
}
