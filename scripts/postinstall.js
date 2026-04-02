#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

// Auto-install Chromium after npm install.
// Fails gracefully — preflight or setup will catch it later.

const isCI = Boolean(process.env.CI);
const label = "[universal-browse]";

process.stdout.write(`${label} Installing Playwright Chromium...\n`);

// Resolve Playwright CLI entry point directly — avoids npx/shell issues on Windows
let playwrightCli;
try {
  const require = createRequire(import.meta.url);
  playwrightCli = require.resolve("playwright/cli");
} catch {
  process.stderr.write(`${label} Playwright not found in node_modules — run: npm install\n`);
  process.exit(isCI ? 1 : 0);
}

const result = spawnSync(process.execPath, [playwrightCli, "install", "chromium"], {
  stdio: "inherit",
  timeout: 120_000,
});

if (result.status === 0) {
  process.stdout.write(`${label} Chromium ready.\n`);
} else if (isCI) {
  process.stderr.write(`${label} Chromium install failed in CI — run: npx playwright install --with-deps chromium\n`);
  process.exit(1);
} else {
  process.stderr.write(`${label} Chromium install failed — run manually: npx playwright install chromium\n`);
}
