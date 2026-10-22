"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BOTS, botName, botPrompt, type BotId } from "@/lib/prompt";

type Minted = { token: string; host: string; command: string; sudo_command: string; prompt: string };

export function BotPromptCard() {
  const [minted, setMinted] = useState<Minted | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "waiting" | "paired" | "reporting">("idle");
  const [copied, setCopied] = useState<"prompt" | "cmd" | null>(null);
  const [bot, setBot] = useState<BotId>("grok");
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

  const prompt = minted ? (bot === "grok" ? minted.prompt : botPrompt({ host: minted.host, token: minted.token, bot: botName(bot) })) : "";
  const cmd = minted ? (useSudo ? minted.sudo_command : minted.command) : "";

  async function copy(what: "prompt" | "cmd") {
    await navigator.clipboard.writeText(what === "prompt" ? prompt : cmd);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="card card-glow p-5" data-testid="bot-prompt-card">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Put your bot on the monitor</h2>
        <span className="text-xs text-muted">Linux · macOS</span>
      </div>

      {!minted ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-secondary">
            You get a prompt. You paste it into your bot. The bot installs a tiny agent on its own computer and hands you a dashboard link.
            No account, no SSH, no reading the docs.
          </p>
          <button className="btn btn-primary btn-lg" onClick={mint} disabled={busy}>
            {busy ? "Minting a token…" : "Get a prompt for your Grok Bot"}
          </button>
          {err && <p className="text-sm text-critical">{err}</p>}
          <p className="text-xs text-muted">Works for Claude Code and Codex too. Or any bot that can run a shell command.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted">Paste this into</div>
            <div className="seg" role="group" aria-label="Which bot">
              {BOTS.map((b) => (
                <button key={b.id} type="button" aria-pressed={bot === b.id} onClick={() => setBot(b.id)}>
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bubble" data-testid="bot-prompt">
            {prompt.split("\n").map((line, i) =>
              line.startsWith("curl ") ? (
                <code key={i} className="block overflow-x-auto whitespace-pre">
                  {line}
                </code>
              ) : (
                <span key={i}>
                  {line}
                  {"\n"}
                </span>
              ),
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" onClick={() => copy("prompt")}>
              {copied === "prompt" ? "Copied. Go paste it." : "Copy prompt"}
            </button>
            <button className="ml-auto text-xs text-muted hover:text-primary" onClick={mint} disabled={busy}>
              new token
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {status === "waiting" && (
              <>
                <span className="h-2 w-2 rounded-full bg-warning pulse" />
                <span className="text-secondary">Listening for your bot… the token is good for 24 hours.</span>
              </>
            )}
            {status === "paired" && (
              <>
                <span className="h-2 w-2 rounded-full bg-s1 pulse" />
                <span className="text-secondary">Paired! First heartbeat incoming…</span>
              </>
            )}
            {status === "reporting" && (
              <>
                <span className="h-2 w-2 rounded-full bg-good" />
                <span className="text-secondary">It&apos;s alive. Opening the dashboard…</span>
              </>
            )}
          </div>

          <details className="text-xs text-muted" data-testid="run-it-yourself">
            <summary className="cursor-pointer select-none hover:text-primary">or run it yourself</summary>
            <div className="mt-2 space-y-2">
              <pre className="cmd" data-testid="raw-command">
                {cmd}
              </pre>
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn" onClick={() => copy("cmd")}>
                  {copied === "cmd" ? "Copied" : "Copy command"}
                </button>
                <label className="flex items-center gap-2 text-xs text-secondary">
                  <input type="checkbox" checked={useSudo} onChange={(e) => setUseSudo(e.target.checked)} />
                  system-wide (sudo)
                </label>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
