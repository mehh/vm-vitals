"use client";

import { useCallback, useEffect, useState } from "react";
import type { Incident } from "@/lib/types";
import { ago } from "@/lib/format";
import { SeverityDot } from "./ui";

export function IncidentTimeline({ machineId, canEdit }: { machineId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Incident[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/machines/${machineId}/incidents`);
    if (r.ok) setItems((await r.json()).incidents);
  }, [machineId]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this incident?")) return;
    await fetch(`/api/machines/${machineId}/incidents/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="kicker">incidents</div>
          <h2 className="mt-2 text-xl font-bold tracking-tight">What broke, what fixed it</h2>
        </div>
        {canEdit && !adding && (
          <button className="btn" onClick={() => setAdding(true)}>
            + Log an incident
          </button>
        )}
      </div>
      <p className="text-sm text-muted">Write it down while it&apos;s fresh. Future you, and everyone you share this with, will thank you.</p>

      {adding && (
        <IncidentForm
          machineId={machineId}
          onDone={() => {
            setAdding(false);
            load();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {items.length === 0 && !adding && <div className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">No incidents logged. Nice.</div>}

      <ol className="space-y-3">
        {items.map((inc) =>
          editing === inc.id ? (
            <li key={inc.id}>
              <IncidentForm
                machineId={machineId}
                existing={inc}
                onDone={() => {
                  setEditing(null);
                  load();
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={inc.id} className="card flex gap-3 p-4">
              <SeverityDot severity={inc.severity} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <div className="font-bold">{inc.title}</div>
                  <div className="mono text-xs text-muted">
                    {new Date(inc.started_at).toLocaleString()} · {inc.severity}
                    {inc.resolved_at ? ` · resolved ${ago(inc.resolved_at)}` : " · open"}
                  </div>
                </div>
                {inc.what_broke && (
                  <div className="mt-2 text-sm">
                    <span className="text-muted">Broke: </span>
                    <span className="whitespace-pre-wrap text-secondary">{inc.what_broke}</span>
                  </div>
                )}
                {inc.what_fixed && (
                  <div className="mt-1 text-sm">
                    <span className="text-muted">Fix: </span>
                    <span className="whitespace-pre-wrap text-secondary">{inc.what_fixed}</span>
                  </div>
                )}
                {canEdit && (
                  <div className="mt-2 flex gap-3 text-xs text-muted">
                    <button className="hover:text-primary" onClick={() => setEditing(inc.id)}>
                      edit
                    </button>
                    <button className="hover:text-critical" onClick={() => remove(inc.id)}>
                      delete
                    </button>
                  </div>
                )}
              </div>
            </li>
          ),
        )}
      </ol>
    </section>
  );
}

function IncidentForm({
  machineId,
  existing,
  onDone,
  onCancel,
}: {
  machineId: string;
  existing?: Incident;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [severity, setSeverity] = useState(existing?.severity ?? "minor");
  const [broke, setBroke] = useState(existing?.what_broke ?? "");
  const [fixed, setFixed] = useState(existing?.what_fixed ?? "");
  const [resolved, setResolved] = useState(existing ? !!existing.resolved_at : false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const body = { title, severity, what_broke: broke, what_fixed: fixed, resolved };
    const r = await fetch(
      existing ? `/api/machines/${machineId}/incidents/${existing.id}` : `/api/machines/${machineId}/incidents`,
      { method: existing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    setBusy(false);
    if (!r.ok) {
      setErr((await r.json().catch(() => ({ error: "failed" }))).error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input className="input" placeholder="Title, e.g. Disk filled up, claude crashed" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={140} />
        <select className="input sm:w-32" value={severity} onChange={(e) => setSeverity(e.target.value as Incident["severity"])}>
          <option value="minor">minor</option>
          <option value="major">major</option>
          <option value="outage">outage</option>
        </select>
      </div>
      <textarea className="input" rows={2} placeholder="What broke?" value={broke} onChange={(e) => setBroke(e.target.value)} />
      <textarea className="input" rows={2} placeholder="What fixed it? (leave empty while still broken)" value={fixed} onChange={(e) => setFixed(e.target.value)} />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" checked={resolved} onChange={(e) => setResolved(e.target.checked)} /> resolved
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : existing ? "Save" : "Log it"}
          </button>
        </div>
      </div>
      {err && <p className="text-sm text-critical">{err}</p>}
    </form>
  );
}
