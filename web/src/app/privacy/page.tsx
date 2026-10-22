import type { Metadata } from "next";
import { appUrl } from "@/lib/format";
import { SITE, src } from "@/lib/site";

export const metadata: Metadata = {
  title: "What it sends",
  description: "Every field the VM Vitals agent reports, what it never reads, and what the server keeps. Open source, so you can check.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  const h = appUrl().replace(/^https?:\/\//, "");
  return (
    <div className="wrap max-w-4xl py-14 md:py-20">
      <div className="kicker">open source · read every line</div>
      <h1 className="display mt-4 text-5xl sm:text-6xl">what it sends.</h1>
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-fg-2">
        Every 30 seconds the agent POSTs one JSON document to {h}/api/ingest. Run <code className="text-fg">vm-vitals once</code> on the box to
        print that exact document. The full list of fields is in{" "}
        <a className="link" href={src("agent/internal/collect/types.go")} target="_blank" rel="noreferrer">
          types.go
        </a>
        .
      </p>

      <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line">
        <Section title="sent">
          <li>Hostname, OS, architecture, kernel or macOS version, uptime, agent version.</li>
          <li>CPU percent and core count. Load averages. Memory and swap totals and usage.</li>
          <li>Per-disk mount point, filesystem type, size and usage. tmpfs, overlay and friends are skipped, except when one of them is the root.</li>
          <li>Network bytes per second in and out, summed across non-loopback interfaces, plus totals since boot.</li>
          <li>Top 8 processes by CPU: pid, executable name, CPU percent, memory percent, resident memory.</li>
          <li>Linux only: the kernel OOM kill counter and, when the journal is readable, &quot;Killed process N (name)&quot; fragments.</li>
          <li>
            Which of a fixed list of CLIs are on PATH (claude, codex, gemini, grok, aider, node, python3, docker, gcloud, tailscale and a few
            more), their path, and the first line of their --version output.
          </li>
          <li>Running agent jobs: tool name, pid, CPU, memory, how long it has run. Helper child processes are folded into their parent.</li>
        </Section>
        <Section title="never sent, never read">
          <li>File contents. The agent reads /proc and asks ps, sysctl, vm_stat and netstat for numbers. The only directory it lists is /Volumes on macOS, to find mounted disks.</li>
          <li>Keystrokes, the clipboard, the screen, prompts or chat logs.</li>
          <li>Environment variables. The agent reads PATH and HOME and nothing else, and probes tools with a minimal environment.</li>
          <li>Command-line arguments. It keeps the basename of argv[0] and argv[1] to spot node cli.js style launches and drops the rest before storing anything.</li>
          <li>API keys, tokens, git remotes, usernames, IP addresses, open ports or connections.</li>
        </Section>
        <Section title="on the server">
          <li>Samples are kept 7 days. The latest full report is kept per machine. Alerts and incidents stay until you delete the machine.</li>
          <li>Machine tokens are stored hashed. Pair tokens expire after 24 hours.</li>
          <li>A machine is private to the browser that paired it until you flip on sharing. The public page shows the same numbers, so don&apos;t share if your hostname is a secret.</li>
        </Section>
      </div>

      <p className="mt-8 text-sm text-muted">
        Spot something that contradicts this page? That&apos;s a bug. Please{" "}
        <a className="link text-fg-2" href={`${SITE.repo}/security/advisories/new`} target="_blank" rel="noreferrer">
          report it privately
        </a>
        .
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 bg-black p-6 md:grid-cols-[12rem_1fr]">
      <h2 className="kicker pt-1">{title}</h2>
      <ul className="list-none space-y-2.5 text-sm leading-relaxed text-fg-2 [&>li]:before:mr-2 [&>li]:before:text-dim [&>li]:before:content-['–']">{children}</ul>
    </section>
  );
}
