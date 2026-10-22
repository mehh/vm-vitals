import Link from "next/link";
import { notFound } from "next/navigation";
import { q, one } from "@/lib/db";
import { getViewer, canManage } from "@/lib/auth";
import { reconcileOffline } from "@/lib/alerts";
import { OFFLINE_AFTER_MS, type Alert, type Machine } from "@/lib/types";
import { appUrl, healthOf } from "@/lib/format";
import { publicMachine } from "@/lib/machines";
import { Dashboard } from "@/components/Dashboard";
import { Critter } from "@/components/Critters";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await one<{ name: string }>(`SELECT name FROM machines WHERE id = $1`, [id]);
  return { title: m?.name ?? "Machine", robots: { index: false } };
}

export default async function MachinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await one<Machine>(`SELECT * FROM machines WHERE id = $1`, [id]);
  if (!m) notFound();
  const viewer = await getViewer();
  if (!canManage(m, viewer)) {
    return (
      <div className="wrap flex max-w-xl flex-col items-center space-y-4 py-24 text-center">
        <Critter kind="grok" id="other" expr="curious" size={120} />
        <h1 className="display text-4xl">not your bot.</h1>
        <p className="text-sm text-fg-2">
          Machines are private to the browser that paired them. If this is yours, open it where you ran the install, or
          claim it by email there and sign in here.
        </p>
        {m.share_public && m.share_slug && (
          <p className="text-sm">
            Its owner made a public page:{" "}
            <Link className="link" href={`/s/${m.share_slug}`}>
              view it
            </Link>
          </p>
        )}
      </div>
    );
  }

  const offline = await reconcileOffline(m.id, m.last_seen_at, OFFLINE_AFTER_MS);
  const alerts = await q<Alert>(
    `SELECT * FROM alerts WHERE machine_id = $1 ORDER BY (resolved_at IS NULL) DESC, opened_at DESC LIMIT 50`,
    [m.id],
  );
  const open = alerts.filter((a) => !a.resolved_at);
  const initial = {
    machine: publicMachine(m),
    report: m.last_report,
    offline,
    health: healthOf({ offline, severities: open.map((a) => a.severity) }),
    alerts,
  };
  return <Dashboard initial={JSON.parse(JSON.stringify(initial))} appUrl={appUrl()} viewerEmail={viewer.email} />;
}
