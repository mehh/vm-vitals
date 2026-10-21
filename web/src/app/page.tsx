import Link from "next/link";
import { getViewer, myMachines } from "@/lib/auth";
import { ago, osLabel } from "@/lib/format";
import { OFFLINE_AFTER_MS } from "@/lib/types";
import { InstallCard } from "@/components/InstallCard";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ claim?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const machines = await myMachines(viewer);

  return (
    <div className="space-y-12">
      {sp.claim === "ok" && (
        <div className="card border-good/40 px-4 py-3 text-sm">
          Signed in as <span className="mono">{viewer.email}</span>. Your machines are now attached to that email.
        </div>
      )}
      {sp.claim === "invalid" && (
        <div className="card border-critical/40 px-4 py-3 text-sm">That link is expired or already used. Request a new one from a machine page.</div>
      )}

      <section className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-start">
        <div className="space-y-5">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Is my AI&apos;s computer <span className="text-good">okay</span>?
          </h1>
          <p className="max-w-prose text-lg text-secondary">
            A free health monitor for the VM or Mac mini that runs your Claude Code, Codex or Grok Bot. One line to
            install. Live charts, alerts when the disk fills or the OOM killer eats your agent, and a share page you can
            post.
          </p>
          <ul className="space-y-1.5 text-sm text-secondary">
            <li>Disk, CPU, memory, load, swap, top processes, OOM kills.</li>
            <li>Which agent CLIs are installed, which agent jobs are running right now.</li>
            <li>Numbers and process names only. Never env vars, arguments, or file contents.</li>
            <li>No signup. Pair with a token, claim with an email later if you want.</li>
          </ul>
          <p className="text-sm text-muted">
            <Link href="/privacy" className="underline decoration-border underline-offset-4 hover:text-primary">
              See exactly what gets sent
            </Link>
          </p>
        </div>
        <div id="install">
          <InstallCard />
        </div>
      </section>

      {machines.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your machines</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {machines.map((m) => {
              const seen = m.last_seen_at ? new Date(m.last_seen_at) : null;
              const offline = !seen || Date.now() - seen.getTime() > OFFLINE_AFTER_MS;
              const r = m.last_report;
              const disk = r?.disks.find((d) => d.mount === "/") ?? r?.disks[0];
              return (
                <li key={m.id}>
                  <Link href={`/m/${m.id}`} className="card block p-4 transition hover:border-[#3a3f4a]">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{m.name}</div>
                      <span className={`h-2 w-2 rounded-full ${offline ? "bg-critical" : "bg-good pulse"}`} />
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {osLabel(m.os)} · {m.arch} · {offline ? `last seen ${ago(seen)}` : ago(seen)}
                    </div>
                    {r && (
                      <div className="mono mt-3 grid grid-cols-3 gap-2 text-xs text-secondary">
                        <span>cpu {Math.round(r.cpu.pct)}%</span>
                        <span>mem {Math.round(r.mem.pct)}%</span>
                        <span>disk {disk ? Math.round(disk.pct) : "–"}%</span>
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-3">
        <Step n={1} title="Get a token">
          Click the button above. The token ties the machine to this browser. Nothing else is needed.
        </Step>
        <Step n={2} title="Run one line on the box">
          Paste the command into the VM, Mac mini, or tell your bot to run it. It installs a systemd or launchd service.
        </Step>
        <Step n={3} title="Watch it, share it">
          The dashboard lights up in about 30 seconds. Flip on sharing and post the link. The card renders live stats.
        </Step>
      </section>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mono text-xs text-muted">0{n}</div>
      <div className="mt-1 font-medium">{title}</div>
      <p className="mt-2 text-sm text-secondary">{children}</p>
    </div>
  );
}
