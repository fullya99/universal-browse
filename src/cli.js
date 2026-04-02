#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolveConfig, readState, clearState, ensureStateDir } from "./config.js";
import { getDisplayStrategy } from "./display-strategy.js";

const config = resolveConfig();

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function health(port) {
  try {
    const res = await fetch(`http://${config.host}:${port}/health`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function startDetachedServer() {
  ensureStateDir(config);

  const strategy = getDisplayStrategy({ mode: config.mode });
  if (strategy.error) throw new Error(strategy.error);

  const nodeArgs = [new URL("./server.js", import.meta.url).pathname];
  let command = process.execPath;
  let args = nodeArgs;
  if (strategy.wrapWithXvfb) {
    command = "xvfb-run";
    args = ["-a", process.execPath, ...nodeArgs];
  }

  const child = spawn(command, args, {
    env: process.env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function ensureServer() {
  let state = readState(config);

  if (state && isAlive(state.pid)) {
    const ok = await health(state.port);
    if (ok) return state;
  }

  clearState(config);
  startDetachedServer();

  const start = Date.now();
  while (Date.now() - start < 15000) {
    state = readState(config);
    if (state) {
      const ok = await health(state.port);
      if (ok) return state;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error("Server failed to start");
}

async function stopServer() {
  const state = readState(config);
  if (!state) {
    process.stdout.write("No running server\n");
    return;
  }
  try {
    process.kill(state.pid, "SIGTERM");
  } catch {}
  clearState(config);
  process.stdout.write("Stopped\n");
}

async function run() {
  const [, , cmd = "help", ...args] = process.argv;

  if (cmd === "help") {
    process.stdout.write(
      [
        "unibrowse commands:",
        "  status",
        "  stop",
        "  goto <url>",
        "  text",
        "  snapshot",
        "  click <selector>",
        "  fill <selector> <value>",
        "  wait <ms>",
        "  viewport <w>x<h>",
        "  screenshot [path]",
        "  cookies",
        "  cookie-import <json-file>",
        "  cookie-import-browser [browser] [--domain d] [--profile p]",
        "  console",
        "  network",
      ].join("\n") + "\n",
    );
    return;
  }

  if (cmd === "stop") {
    await stopServer();
    return;
  }

  const state = await ensureServer();

  if (cmd === "status") {
    const h = await health(state.port);
    process.stdout.write(`${JSON.stringify({ pid: state.pid, ...h }, null, 2)}\n`);
    return;
  }

  const res = await fetch(`http://${config.host}:${state.port}/command`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${state.token}`,
    },
    body: JSON.stringify({ command: cmd, args }),
  });
  const payload = await res.json();
  if (!payload.ok) {
    process.stderr.write(`${payload.error}\n`);
    process.exit(1);
  }
  if (typeof payload.output === "string") {
    process.stdout.write(`${payload.output}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(payload.output, null, 2)}\n`);
  }
}

run().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
