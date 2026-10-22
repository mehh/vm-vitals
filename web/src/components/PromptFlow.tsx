"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BOTS, botName, botPrompt, type BotId } from "@/lib/prompt";

type Minted = { token: string; host: string; command: string; sudo_command: string; prompt: string };
type Status = "idle" | "waiting" | "paired" | "reporting";

const promptFor = (m: Minted, bot: BotId) => (bot === "grok" ? m.prompt : botPrompt({ host: m.host, token: m.token, bot: botName(bot) }));

/**
 * The hero CTA. One click mints a pair token and copies the prompt in the
 * same gesture (ClipboardItem with a promise keeps Safari's user activation
 * alive across the fetch). Then it listens for the bot to pair and jumps to
 * the dashboard once the first heartbeat lands.
 */
export function PromptFlow({ host }: { host: string }) {
  const [minted, setMinted] = useState<Minted | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [copied, setCopied] = useState<"prompt" | "cmd" | null>(null);
  const [bot, setBot] = useState<BotId>("grok");
  const [useSudo, setUseSudo] = useState(false);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    const req = fetch("/api/pair-tokens", { method: "POST" }).then(async (r) => {
      if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
      return (await r.json()) as Minted;
    });
    let didCopy = false;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const blob = req.then((m) => new Blob([promptFor(m, bot)], { type: "text/plain" }));
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
        didCopy = true;
      }
    } catch {
      // Clipboard refused (permissions, old browser). The prompt still shows with a copy button.
    }
    try {
      setMinted(await req);
      setStatus("waiting");
      if (didCopy) flashCopied("prompt");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "couldn't mint a token");
    } finally {
      setBusy(false);
    }
  }

  function flashCopied(what: "prompt" | "cmd") {
    setCopied(what);
    setTimeout(() => setCopied(null), 2200);
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
          router.push(`/m/${j.machine.id}?fresh=1`);
        }
      }
    }, 3000);
    return () => clearInterval(timer.current!);
  }, [minted, status, router]);

  const prompt = minted ? promptFor(minted, bot) : "";
  const cmd = minted ? (useSudo ? minted.sudo_command : minted.command) : "";

  async function copy(what: "prompt" | "cmd") {
    await navigator.clipboard.writeText(what === "prompt" ? prompt : cmd);
    flashCopied(what);
  }

  if (!minted) {
    const preview = botPrompt({ host, token: "pair_••••••••••••••••" });
    return (
      <div className="space-y-4" data-testid="bot-prompt-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <button className="btn btn-primary btn-lg" onClick={start} disabled={busy}>
            <CopyGlyph />
            {busy ? "Minting a token…" : "Copy prompt for your Grok Bot"}
          </button>
        </div>
        {err && <p className="text-sm text-bad">Couldn&apos;t mint a token: {err}</p>}
        <details className="text-xs text-muted [&[open]>summary]:text-fg" id="prompt-preview">
          <summary className="cursor-pointer select-none hover:text-fg">read the prompt first ↓</summary>
          <div className="bubble mt-3">{renderPrompt(preview)}</div>
          <p className="mt-2">Your copy gets a real one-time token in place of the dots. It&apos;s good for 24 hours and tied to this browser.</p>
        </details>
      </div>
    );
  }

  return (
    <div className="rise space-y-4" data-testid="bot-prompt-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {copied === "prompt" ? (
            <span className="flash rounded px-1">✓ Copied. Now paste it to {botName(bot)}.</span>
          ) : (
            <span className="text-fg-2">Paste this to {botName(bot)}:</span>
          )}
        </div>
        <div className="seg" role="group" aria-label="Which bot">
          {BOTS.map((b) => (
            <button key={b.id} type="button" aria-pressed={bot === b.id} onClick={() => setBot(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bubble" data-testid="bot-prompt">
        {renderPrompt(prompt)}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={() => copy("prompt")}>
          <CopyGlyph />
          {copied === "prompt" ? "Copied" : "Copy prompt"}
        </button>
        <StatusLine status={status} />
        <button className="ml-auto text-xs text-muted hover:text-fg" onClick={start} disabled={busy}>
          new token
        </button>
      </div>

      <details className="text-xs text-muted" data-testid="run-it-yourself">
        <summary className="cursor-pointer select-none hover:text-fg">or run it yourself</summary>
        <div className="mt-3 space-y-3">
          <pre className="cmd" data-testid="raw-command">
            <span className="text-dim">$ </span>
            {cmd}
          </pre>
          <div className="flex flex-wrap items-center gap-4">
            <button className="btn" onClick={() => copy("cmd")}>
              {copied === "cmd" ? "Copied" : "Copy command"}
            </button>
            <label className="flex items-center gap-2 text-fg-2">
              <input type="checkbox" checked={useSudo} onChange={(e) => setUseSudo(e.target.checked)} className="accent-white" />
              system-wide (sudo)
            </label>
            <a href="/install.sh" className="link" target="_blank">
              read install.sh
            </a>
          </div>
        </div>
      </details>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  const dot = (c: string, pulse = true) => <span className={`inline-block h-2 w-2 rounded-full ${pulse ? "pulse" : ""}`} style={{ background: c }} />;
  return (
    <div className="flex items-center gap-2 text-xs text-fg-2" aria-live="polite">
      {status === "waiting" && (
        <>
          {dot("var(--warn)")} Listening for your bot…
        </>
      )}
      {status === "paired" && (
        <>
          {dot("var(--fg)")} Paired. First heartbeat incoming…
        </>
      )}
      {status === "reporting" && (
        <>
          {dot("var(--ok)", false)} It&apos;s alive. Opening the dashboard…
        </>
      )}
    </div>
  );
}

function renderPrompt(text: string) {
  return text.split("\n").map((line, i) =>
    line.startsWith("curl ") ? (
      <code key={i}>{line}</code>
    ) : (
      <span key={i}>
        {line}
        {"\n"}
      </span>
    ),
  );
}

function CopyGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
    </svg>
  );
}
