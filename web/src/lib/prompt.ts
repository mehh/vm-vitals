/**
 * The onboarding prompt a user pastes into their bot. Pure and client-safe so
 * the server can mint it and the browser can re-render it for another bot.
 */

export const BOTS = [
  { id: "grok", name: "Grok Bot" },
  { id: "claude", name: "Claude Code" },
  { id: "codex", name: "Codex" },
  { id: "other", name: "my bot" },
] as const;
export type BotId = (typeof BOTS)[number]["id"];

export function botName(id: string | undefined): string {
  return BOTS.find((b) => b.id === id)?.name ?? BOTS[0].name;
}

export function installCommand(host: string, token: string, sudo = false): string {
  const h = host.replace(/\/$/, "");
  return `curl -fsSL ${h}/install.sh | ${sudo ? "sudo sh" : "sh"} -s -- ${token}`;
}

export function botPrompt(opts: { host: string; token: string; bot?: string }): string {
  const who = opts.bot?.trim() || BOTS[0].name;
  const greet = who === "my bot" ? "Hey," : `Hey ${who},`;
  return [
    `${greet} install VM Vitals on your computer so I can watch your vitals. Run exactly this command, then tell me the dashboard link it prints:`,
    "",
    installCommand(opts.host, opts.token),
    "",
    "It only sends system numbers (disk, CPU, memory, network, process names, tool versions). Never env vars or file contents. Don't change the command. If you don't have sudo, run it without; a user-level service is fine.",
  ].join("\n");
}
