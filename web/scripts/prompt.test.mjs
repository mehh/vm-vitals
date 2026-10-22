import { test } from "node:test";
import assert from "node:assert/strict";
import { botPrompt, installCommand, botName, BOTS } from "../src/lib/prompt.ts";

const host = "https://vm-vitals.vercel.app";
const token = "pair_testtoken1234567890abcdef";

test("install command, plain and sudo", () => {
  assert.equal(installCommand(host, token), `curl -fsSL ${host}/install.sh | sh -s -- ${token}`);
  assert.equal(installCommand(host + "/", token, true), `curl -fsSL ${host}/install.sh | sudo sh -s -- ${token}`);
});

test("default prompt talks to Grok Bot and carries the exact command", () => {
  const p = botPrompt({ host, token });
  assert.ok(p.startsWith("Hey Grok Bot, install VM Vitals on your computer so I can watch your vitals."));
  assert.ok(p.includes("\n" + installCommand(host, token) + "\n"));
  assert.match(p, /tell me the dashboard link/);
  assert.match(p, /Never env vars or file contents/);
  assert.doesNotMatch(p, /sudo sh/);
});

test("prompt can address another bot", () => {
  assert.ok(botPrompt({ host, token, bot: "Claude Code" }).startsWith("Hey Claude Code,"));
  assert.ok(botPrompt({ host, token, bot: "my bot" }).startsWith("Hey, install"));
  assert.ok(botPrompt({ host, token, bot: "   " }).startsWith("Hey Grok Bot,"));
});

test("bot names resolve, unknown falls back to Grok Bot", () => {
  assert.equal(botName("claude"), "Claude Code");
  assert.equal(botName("nope"), "Grok Bot");
  assert.equal(BOTS[0].name, "Grok Bot");
});

test("the token appears exactly once in the prompt", () => {
  const p = botPrompt({ host, token });
  assert.equal(p.split(token).length - 1, 1);
});
