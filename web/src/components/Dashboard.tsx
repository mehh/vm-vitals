"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Alert, Report } from "@/lib/types";
import type { PublicMachine } from "@/lib/machines";
import { ago, osLabel, type Health } from "@/lib/format";
import { HealthBadge } from "./ui";
import { ReportView, AlertsList } from "./ReportView";
import { Charts } from "./Charts";
import { IncidentTimeline } from "./IncidentTimeline";

interface Snapshot {
  machine: PublicMachine;
  report: Report | null;
  offline: boolean;
  health: Health;
  alerts: Alert[];
}

export function Dashboard({ initial, appUrl, viewerEmail }: { initial: Snapshot; appUrl: string; viewerEmail: string | null }) {
  const [snap, setSnap] = useState<Snapshot>(initial);
  const [now, setNow] = useState(Date.now());
  const router = useRouter();

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/machines/${initial.machine.id}`, { cache: "no-store" });
    if (r.ok) setSnap(await r.json());
  }, [initial.machine.id]);

  useEffect(() => {
    const t = setInterval(refresh, 10000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearInterval(tick);
    };
  }, [refresh]);

  const m = snap.machine;
  const shareUrl = `${appUrl}/s/${m.share_slug}`;

  async function patch(body: Record<string, unknown>) {
    const r = await fetch(`/api/machines/${m.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) refresh();
  }

  async function rename() {
    const name = prompt("Machine name", m.name);
    if (name && name !== m.name) patch({ name });
  }

  async function remove() {
    if (!confirm(`Delete ${m.name} and all its data? The agent on the box will keep trying to report until you run: vm-vitals uninstall`)) return;
    const r = await fetch(`/api/machines/${m.id}`, { method: "DELETE" });
    if (r.ok) router.push("/");
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{m.name}</h1>
            <HealthBadge health={snap.health} big />
          </div>
          <div className="mono mt-1 text-xs text-muted">
            {m.hostname} · {osLabel(m.os)} {m.arch} · {snap.offline ? "last seen" : "reported"} {ago(m.last_seen_at, now)}
            {m.agent_version ? ` · agent ${m.agent_version}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={rename}>
            Rename
          </button>
          <button className="btn btn-danger" onClick={remove}>
            Delete
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Alerts</h2>
            <span className="mono text-xs text-muted">disk ≥85% · mem ≥90% · OOM · job died · offline</span>
          </div>
          <AlertsList alerts={snap.alerts.slice(0, 12)} />
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Share</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={m.share_public} onChange={(e) => patch({ share_public: e.target.checked })} />
              public page
            </label>
          </div>
          {m.share_public ? (
            <div className="space-y-2">
              <pre className="cmd select-all">{shareUrl}</pre>
              <div className="flex flex-wrap gap-2">
                <a className="btn" href={shareUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
                <a
                  className="btn"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://x.com/intent/post?text=${encodeURIComponent(`my AI's computer, live: ${shareUrl}`)}`}
                >
                  Post on X
                </a>
                <button className="btn" onClick={() => navigator.clipboard.writeText(shareUrl)}>
                  Copy link
                </button>
              </div>
              <p className="text-xs text-muted">The link unfurls into a live card with the current stats. Anyone with it can see this machine&apos;s numbers and incidents.</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Private. Only this browser (and your email, once claimed) can see it. Turn on sharing to get a link and an X card.</p>
          )}
          <ClaimBox claimed={m.claimed} viewerEmail={viewerEmail} />
        </section>
      </div>

      {snap.report ? (
        <>
          <Charts machineId={m.id} />
          <ReportView report={snap.report} />
        </>
      ) : (
        <div className="card p-8 text-center text-sm text-muted">
          <div className="mx-auto mb-3 h-2 w-2 rounded-full bg-warning pulse" />
          Paired, waiting for the first report. The agent sends one every 30 seconds.
        </div>
      )}

      <IncidentTimeline machineId={m.id} canEdit />
    </div>
  );
}

function ClaimBox({ claimed, viewerEmail }: { claimed: boolean; viewerEmail: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "logged" | "err">("idle");
  const [msg, setMsg] = useState("");

  if (claimed || viewerEmail) {
    return (
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
        {viewerEmail ? `Signed in as ${viewerEmail}.` : "Claimed by email."} Machines follow your email across browsers.
      </p>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const j = await r.json();
    if (!r.ok) {
      setState("err");
      setMsg(j.error ?? "failed");
      return;
    }
    setState(j.delivered ? "sent" : "logged");
  }

  return (
    <form onSubmit={send} className="mt-4 border-t border-border pt-3">
      <div className="mb-2 text-xs text-muted">
        Optional: claim with an email so you can open this from another browser or your phone. No password.
      </div>
      {state === "sent" ? (
        <p className="text-sm text-good">Check your inbox for the link.</p>
      ) : state === "logged" ? (
        <p className="text-sm text-warning">No email provider configured. The link was printed to the server log.</p>
      ) : (
        <div className="flex gap-2">
          <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="btn shrink-0" type="submit">
            Send link
          </button>
        </div>
      )}
      {state === "err" && <p className="mt-1 text-xs text-critical">{msg}</p>}
    </form>
  );
}
