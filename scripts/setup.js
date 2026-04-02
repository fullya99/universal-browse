#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

// One-command setup for all platforms.
// Usage: npm run setup  (or: node scripts/setup.js)

const label = "[universal-browse]";
const isLinux = process.platform === "linux";

function run(cmd, args, description) {
  process.stdout.write(`${label} ${description}...\n`);
  const result = spawnSync(cmd, args, { stdio: "inherit", timeout: 180_000 });
  if (result.status !== 0) {
    process.stderr.write(`${label} FAILED: ${description}\n`);
    process.exit(1);
  }
}

// Step 1: npm install
run(process.execPath, [process.env.npm_execpath || "npm", "install"], "Installing npm dependencies");

// Step 2: Playwright Chromium
let playwrightCli;
try {
  const require = createRequire(import.meta.url);
  playwrightCli = require.resolve("playwright/cli");
} catch {
  process.stderr.write(`${label} FAILED: Playwright not found after npm install\n`);
  process.exit(1);
}

const playwrightArgs = isLinux
  ? [playwrightCli, "install", "--with-deps", "chromium"]
  : [playwrightCli, "install", "chromium"];
const playwrightLabel = isLinux
  ? "Installing Playwright Chromium + system dependencies (Linux)"
  : "Installing Playwright Chromium";
run(process.execPath, playwrightArgs, playwrightLabel);

// Step 3: Preflight verification
run(process.execPath, ["scripts/preflight.js"], "Running preflight checks");

// Platform hints
if (isLinux) {
  process.stdout.write(`${label} Hint: for headed mode on a VPS, install Xvfb: sudo apt-get install -y xvfb\n`);
}

process.stdout.write(`\n${label} Setup complete. Run: npm run unibrowse -- status\n`);
