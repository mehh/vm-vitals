import type { Metadata } from "next";
import Link from "next/link";
import { appUrl } from "@/lib/format";
import { SITE, src } from "@/lib/site";
import { Critter } from "@/components/Critters";
import { PromptFlow } from "@/components/PromptFlow";

export const metadata: Metadata = {
  title: "Install",
  description: "Hand your Grok Bot one prompt and it installs VM Vitals on its own computer. Or run the one-line installer yourself. Linux and macOS, open source.",
  alternates: { canonical: "/install" },
};

export default function Install() {
  const host = appUrl();
  const h = host.replace(/^https?:\/\//, "");
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
        <div className="wrap relative grid grid-cols-1 gap-10 py-14 md:py-20 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0 max-w-2xl">
            <div className="kicker">install · linux and macos</div>
            <h1 className="display mt-4 text-5xl sm:text-6xl">let the bot install it.</h1>
            <p className="mt-5 text-sm leading-relaxed text-fg-2 sm:text-[15px]">
              Copy the prompt, paste it to Grok Bot (or Claude Code, or Codex). It runs one line on its own computer and hands you the dashboard
              link. This page jumps there by itself when the first heartbeat lands.
            </p>
            <div className="mt-8">
              <PromptFlow host={host} />
            </div>
          </div>
          <Critter kind="grok" id="install-grok" expr="busy" size={200} className="hidden lg:block" />
        </div>
      </section>

      <div className="wrap grid grid-cols-1 gap-12 pt-16 lg:grid-cols-2">
        <section className="min-w-0">
          <div className="kicker">open source · read every line</div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">What gets installed</h2>
          <ul className="mt-6 divide-y divide-line border-y border-line text-sm">
            <Row k="binary">
              <code>~/.local/bin/vm-vitals</code>, a static Go binary, about 6 MB. With sudo it goes to <code>/usr/local/bin</code>.{" "}
              <a className="link" href={src("agent/main.go")} target="_blank" rel="noreferrer">
                source
              </a>
            </Row>
            <Row k="config">
              <code>~/.config/vm-vitals/config.json</code>, mode 600. Server URL, machine id and the machine token.
            </Row>
            <Row k="service">
              Linux: a systemd unit. macOS: a launchd agent. No systemd bus (containers, some VMs): a background process plus a crontab
              @reboot line.{" "}
              <a className="link" href={src("agent/internal/svc/service.go")} target="_blank" rel="noreferrer">
                the templates
              </a>
            </Row>
            <Row k="network">One HTTPS POST to {h}/api/ingest every 30 seconds. Nothing listens on a port.</Row>
            <Row k="installer">
              <a className="link" href="/install.sh" target="_blank">
                install.sh
              </a>{" "}
              downloads the binary for your OS and CPU and runs <code>vm-vitals install</code>. Read it before you pipe it.
            </Row>
          </ul>
          <p className="mt-4 text-xs text-muted">
            Exactly what it sends is on{" "}
            <Link className="link" href="/privacy">
              what it sends
            </Link>
            . Every line is on{" "}
            <a className="link" href={SITE.repo} target="_blank" rel="noreferrer">
              GitHub
            </a>
            .
          </p>
        </section>

        <section className="min-w-0">
          <div className="kicker">after</div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">Inspect it, stop it, remove it</h2>
          <pre className="term mt-6 text-xs leading-6">
            <span className="text-dim"># print the exact JSON it sends, then exit</span>
            {"\n"}
            <span className="p">$ </span>vm-vitals once{"\n\n"}
            <span className="text-dim"># paths, whether it&apos;s running, and the service file verbatim</span>
            {"\n"}
            <span className="p">$ </span>vm-vitals status{"\n\n"}
            <span className="text-dim"># logs</span>
            {"\n"}
            <span className="p">$ </span>journalctl --user -u vm-vitals -f{"        "}
            <span className="text-dim"># linux</span>
            {"\n"}
            <span className="p">$ </span>tail -f ~/Library/Logs/vm-vitals/agent.log{"  "}
            <span className="text-dim"># macos</span>
            {"\n\n"}
            <span className="text-dim"># stop it and delete the service, binary, config and logs</span>
            {"\n"}
            <span className="p">$ </span>curl -fsSL {h}/uninstall.sh | sh
          </pre>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            <code>vm-vitals uninstall</code> does the same if <code>~/.local/bin</code> is on your PATH. Installed with sudo? Put sudo in front
            of <code>sh</code>. Then delete the machine from its dashboard to drop its history.
          </p>
        </section>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[6rem_1fr] gap-3 py-4">
      <span className="kicker pt-0.5">{k}</span>
      <span className="min-w-0 leading-relaxed text-fg-2 [&_code]:text-fg">{children}</span>
    </li>
  );
}
