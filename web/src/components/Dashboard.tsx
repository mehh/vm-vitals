"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Alert, Report } from "@/lib/types";
import type { PublicMachine } from "@/lib/machines";
import { ago, osLabel, type Health } from "@/lib/format";
import { healthScore, moodFor } from "@/lib/vitals";
import { HealthBadge } from "./ui";
import { ReportView } from "./ReportView";
import { Charts } from "./Charts";
import { IncidentTimeline } from "./IncidentTimeline";
import { MachineHero } from "./MachineHero";
import { CrewBoard } from "./CrewBoard";

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
  const fresh = useSearchParams().get("fresh") === "1";

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/machines/${initial.machine.id}`, { cache: "no-store" });
    if (r.ok) setSnap(await r.json());
  }, [initial.machine.id]);

  useEffect(() => {
    // Poll fast until the first report lands, then settle to every 10s.
    const t = setInterval(refresh, snap.report ? 10000 : 3000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearInterval(tick);
    };
  }, [refresh, snap.report]);

  const m = snap.machine;
  const open = snap.alerts.filter((a) => !a.resolved_at).map((a) => a.severity);

  async function patch(body: Record<string, unknown>) {
    const r = await fetch(`/api/machines/${m.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) refresh();
  }

  async function rename() {
    const name = prompt("Machine name", m.name);
    if (name && name !== m.name) patch({ name });
  }

  async function remove() {
    if (!confirm(`Delete ${m.name} and all its data? To stop the agent on the box too, run: curl -fsSL ${appUrl.replace(/^https?:\/\//, "")}/uninstall.sh | sh`)) return;
    const r = await fetch(`/api/machines/${m.id}`, { method: "DELETE" });
    if (r.ok) router.push("/");
  }

  return (
    <div>
      {fresh && snap.report && (
        <div className="border-b border-ok/40 bg-ok/5 px-5 py-3 text-center text-sm text-ok">It&apos;s alive. Your bot paired itself and the first heartbeat is in. Share it below ↓</div>
      )}
      <MachineHero
        id={m.id}
        name={m.name}
        kicker={m.share_public ? "your bot's computer · public" : "your bot's computer · private"}
        meta={
          <>
            {m.hostname} · {osLabel(m.os)} {m.arch} · {snap.offline ? "last seen" : "heartbeat"} {ago(m.last_seen_at, now)}
            {m.agent_version ? ` · agent ${m.agent_version}` : ""}
          </>
        }
        report={snap.report}
        offline={snap.offline}
        openSeverities={open}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <HealthBadge health={snap.health} big />
            <button className="btn" onClick={rename}>
              rename
            </button>
            <button className="btn btn-danger" onClick={remove}>
              delete
            </button>
          </div>
        }
      />

      <div className="wrap space-y-16 pt-10">
        {snap.report ? (
          <CrewBoard machineId={m.id} report={snap.report} offline={snap.offline} />
        ) : (
          <div className="rounded-lg border border-dashed border-line-strong p-10 text-center">
            <div className="text-base">Paired. Listening for the first heartbeat…</div>
            <div className="mt-2 text-sm text-muted">The agent reports every 30 seconds. This page checks every 3 and fills in the moment it lands.</div>
          </div>
        )}

        <SharePanel machine={m} appUrl={appUrl} report={snap.report} offline={snap.offline} open={open} onToggle={(v) => patch({ share_public: v })} viewerEmail={viewerEmail} />

        {snap.report && (
          <>
            <Charts machineId={m.id} />
            <section className="space-y-4">
              <div>
                <div className="kicker">right now</div>
                <h2 className="mt-2 text-xl font-bold tracking-tight">What the box is up to</h2>
              </div>
              <ReportView report={snap.report} alerts={snap.alerts} />
            </section>
          </>
        )}

        <IncidentTimeline machineId={m.id} canEdit />
      </div>
    </div>
  );
}

function SharePanel({
  machine: m,
  appUrl,
  report,
  offline,
  open,
  onToggle,
  viewerEmail,
}: {
  machine: PublicMachine;
  appUrl: string;
  report: Report | null;
  offline: boolean;
  open: string[];
  onToggle: (v: boolean) => void;
  viewerEmail: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [v, setV] = useState(0);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && !!navigator.share), []);
  useEffect(() => {
    const t = setInterval(() => setV((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const shareUrl = `${appUrl}/s/${m.share_slug}`;
  const input = { report, offline, openSeverities: open };
  const mood = moodFor(input);
  const score = healthScore(input);
  const text = report && !offline ? `${m.name} is ${mood.label.toLowerCase()} ${mood.emoji} health ${score}/100. my AI's computer, live:` : `my AI's computer, live:`;

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  async function share() {
    try {
      await navigator.share({ title: `${m.name} · VM Vitals`, text, url: shareUrl });
    } catch {
      // dismissed
    }
  }

  return (
    <section className="grid grid-cols-1 gap-8 rounded-lg border border-line p-5 sm:p-8 lg:grid-cols-[1fr_1.15fr]" data-testid="share-panel">
      <div className="min-w-0">
        <div className="kicker">show it off</div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight">Public page</h2>
          <button type="button" role="switch" aria-checked={m.share_public} aria-label="Public page" className="switch shrink-0" onClick={() => onToggle(!m.share_public)} />
        </div>
        {m.share_public ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-fg-2">Anyone with the link sees this machine&apos;s numbers, crew and incidents. Turn it off and the link goes dark.</p>
            <div className="flex gap-2">
              <input className="input min-w-0 flex-1" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
              <button className="btn btn-primary shrink-0" onClick={copy}>
                {copied ? "Copied ✓" : "Copy link"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {canShare && (
                <button className="btn" onClick={share}>
                  Share…
                </button>
              )}
              <a className="btn" target="_blank" rel="noreferrer" href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`}>
                Post on X
              </a>
              <a className="btn" href={shareUrl} target="_blank" rel="noreferrer">
                Open ↗
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-fg-2">Private for now. Only this browser, and your email once you claim it, can see it. Flip the switch for a link your friends can open and a card that unfurls with the live crew.</p>
            <button className="btn btn-primary" onClick={() => onToggle(true)}>
              Make it public
            </button>
          </div>
        )}
        <ClaimBox claimed={m.claimed} viewerEmail={viewerEmail} />
      </div>
      <div className="min-w-0">
        <div className="kicker mb-3">{m.share_public ? "what your friends see · live" : "preview · goes live when public"}</div>
        {m.share_public ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/s/${m.share_slug}/opengraph-image?v=${v}`} alt={`Share card for ${m.name}`} width={1200} height={630} className="w-full rounded-md border border-line" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/og/demo" alt="Example share card" width={1200} height={630} className="w-full rounded-md border border-line opacity-40 grayscale" />
        )}
      </div>
    </section>
  );
}

function ClaimBox({ claimed, viewerEmail }: { claimed: boolean; viewerEmail: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "logged" | "err">("idle");
  const [msg, setMsg] = useState("");

  if (claimed || viewerEmail) {
    return (
      <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
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
    <form onSubmit={send} className="mt-6 border-t border-line pt-4">
      <div className="mb-2 text-xs text-muted">Want to check from your phone? Claim it with an email. No password.</div>
      {state === "sent" ? (
        <p className="text-sm text-ok">Check your inbox for the link.</p>
      ) : state === "logged" ? (
        <p className="text-sm text-warn">No email provider is set up here, so the link went to the server log.</p>
      ) : (
        <div className="flex gap-2">
          <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className="btn shrink-0" type="submit">
            Send link
          </button>
        </div>
      )}
      {state === "err" && <p className="mt-1 text-xs text-bad">{msg}</p>}
    </form>
  );
}
