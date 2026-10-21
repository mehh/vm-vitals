"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Minted = { token: string; command: string; sudo_command: string };

export function InstallCard() {
  const [minted, setMinted] = useState<Minted | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "waiting" | "paired" | "reporting">("idle");
  const [copied, setCopied] = useState(false);
  const [useSudo, setUseSudo] = useState(false);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function mint() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/pair-tokens", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      setMinted(await r.json());
      setStatus("waiting");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!minted || status === "reporting") return;
    timer.current = setInterval(async () => {
      const r = await fetch(`/api/pair-tokens/${minted.token}`);
      if (!r.ok) return;
      const j = await r.json();
      if (j.paired) {
        setStatus(j.reporting ? "reporting" : "paired");
        if (j.reporting) {
          clearInterval(timer.current!);
          router.push(`/m/${j.machine.id}`);
        }
      }
    }, 3000);
    return () => clearInterval(timer.current!);
  }, [minted, status, router]);

  const cmd = minted ? (useSudo ? minted.sudo_command : minted.command) : "";

  async function copy() {
    await navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Install on a machine</h2>
        <span className="text-xs text-muted">Linux · macOS</span>
      </div>

      {!minted ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-secondary">
            Generates a one-time pair token. The machine that runs the command shows up here, in this browser. No
            account needed.
          </p>
          <button className="btn btn-primary" onClick={mint} disabled={busy}>
            {busy ? "Generating…" : "Get my install command"}
          </button>
          {err && <p className="text-sm text-critical">{err}</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <pre className="cmd">{cmd}</pre>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
            <label className="flex items-center gap-2 text-xs text-secondary">
              <input type="checkbox" checked={useSudo} onChange={(e) => setUseSudo(e.target.checked)} />
              system-wide (sudo)
            </label>
            <button className="ml-auto text-xs text-muted hover:text-primary" onClick={mint} disabled={busy}>
              new token
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {status === "waiting" && (
              <>
                <span className="h-2 w-2 rounded-full bg-warning pulse" />
                <span className="text-secondary">Waiting for the machine to pair… (token valid 24h)</span>
              </>
            )}
            {status === "paired" && (
              <>
                <span className="h-2 w-2 rounded-full bg-s1 pulse" />
                <span className="text-secondary">Paired. Waiting for the first report…</span>
              </>
            )}
            {status === "reporting" && (
              <>
                <span className="h-2 w-2 rounded-full bg-good" />
                <span className="text-secondary">Reporting. Opening dashboard…</span>
              </>
            )}
          </div>
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">Have a bot? Tell it to install this</summary>
            <pre className="cmd mt-2 whitespace-pre-wrap">{`Install the VM Vitals health monitor on this machine so I can watch your computer from my phone. Run exactly this command, then tell me the dashboard URL it prints:

${cmd}

It only sends system metrics (disk, CPU, memory, process names, tool versions). Do not modify the command.`}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
