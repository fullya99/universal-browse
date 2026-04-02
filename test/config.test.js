import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveConfig } from "../src/config.js";

test("resolveConfig uses provided project dir", () => {
  const projectDir = path.join("tmp", "demo");
  const cfg = resolveConfig({ UNIVERSAL_BROWSE_PROJECT_DIR: projectDir });
  assert.equal(cfg.projectDir, projectDir);
  assert.equal(cfg.stateDir, path.join(projectDir, ".universal-browse"));
  assert.equal(cfg.mode, "headless");
});

test("resolveConfig accepts headed mode", () => {
  const projectDir = path.join("tmp", "demo");
  const cfg = resolveConfig({
    UNIVERSAL_BROWSE_PROJECT_DIR: projectDir,
    UNIVERSAL_BROWSE_MODE: "headed",
  });
  assert.equal(cfg.mode, "headed");
});

test("resolveConfig reuses persisted daemon mode when env is unset", () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "universal-browse-config-test-"));
  const stateDir = path.join(projectDir, ".universal-browse");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, "state.json"), JSON.stringify({ mode: "headed" }, null, 2));

  try {
    const cfg = resolveConfig({ UNIVERSAL_BROWSE_PROJECT_DIR: projectDir });
    assert.equal(cfg.mode, "headed");
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});
