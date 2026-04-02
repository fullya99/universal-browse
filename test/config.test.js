import test from "node:test";
import assert from "node:assert/strict";
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
