import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

function gitRoot() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
    timeout: 1500,
  });
  if (result.status !== 0) return null;
  const root = result.stdout.trim();
  return root.length > 0 ? root : null;
}

export function resolveConfig(env = process.env) {
  const projectDir = env.UNIVERSAL_BROWSE_PROJECT_DIR || gitRoot() || process.cwd();
  const stateDir = path.join(projectDir, ".universal-browse");
  const stateFile = path.join(stateDir, "state.json");
  let mode = "headless";
  if (env.UNIVERSAL_BROWSE_MODE === "headed") {
    mode = "headed";
  } else {
    try {
      const persisted = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      if (persisted?.mode === "headed") mode = "headed";
    } catch {}
  }
  return {
    projectDir,
    stateDir,
    stateFile,
    mode,
    host: "127.0.0.1",
    homeDir: os.homedir(),
  };
}

export function ensureStateDir(config) {
  fs.mkdirSync(config.stateDir, { recursive: true });
}

export function readState(config) {
  try {
    const raw = fs.readFileSync(config.stateFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeState(config, data) {
  ensureStateDir(config);
  fs.writeFileSync(config.stateFile, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function clearState(config) {
  try {
    fs.unlinkSync(config.stateFile);
  } catch {}
}
