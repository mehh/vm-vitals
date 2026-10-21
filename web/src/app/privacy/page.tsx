export const metadata = { title: "What gets sent" };

export default function Privacy() {
  return (
    <article className="prose-invert max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">What the agent sends</h1>
      <p className="text-secondary">
        Every 30 seconds the agent POSTs one JSON document. You can print the exact document at any time with{" "}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 text-sm">vm-vitals once</code>. Here is the full list of
        fields.
      </p>

      <Section title="Sent">
        <li>Hostname, OS, architecture, kernel or macOS version, uptime, agent version.</li>
        <li>CPU percent and core count. Load averages. Memory and swap totals and usage.</li>
        <li>Per-disk mount point, filesystem type, size and usage. tmpfs and the like are skipped.</li>
        <li>Top 8 processes by CPU: pid, executable name, CPU percent, memory percent, resident memory.</li>
        <li>OOM kill counter from the kernel and, when readable, the "Killed process N (name)" fragments.</li>
        <li>
          Which of a fixed list of CLIs are on PATH (claude, codex, gemini, grok, aider, node, python3, docker, gcloud,
          tailscale, …), their path, and the first line of their --version output.
        </li>
        <li>
          Running agent jobs: tool name, pid, CPU, memory, how long it has been running. Helper child processes are
          folded into their parent.
        </li>
      </Section>

      <Section title="Never sent">
        <li>Environment variables. The agent does not read its own environment except PATH and HOME.</li>
        <li>Command-line arguments. The agent keeps the basename of argv[0] and argv[1] (to detect node cli.js style launches) and discards the rest before storing anything in memory structures.</li>
        <li>File contents, directory listings, logs, prompts, API keys, git remotes, usernames.</li>
        <li>Network addresses, open ports, or connections.</li>
      </Section>

      <Section title="On the server">
        <li>Samples are kept 7 days. The latest full report is kept per machine. Alerts and incidents are kept until you delete the machine.</li>
        <li>Machine tokens are stored hashed. Pair tokens expire after 24 hours.</li>
        <li>A machine is private to the browser that paired it until you flip on sharing. The public page shows the same numbers, minus nothing: don&apos;t share if your hostname is a secret.</li>
      </Section>

      <p className="text-sm text-muted">
        The agent is small Go with no dependencies. Read it in <code>agent/</code>.
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-secondary">{children}</ul>
    </section>
  );
}
