import test from "node:test";
import assert from "node:assert/strict";
import { resolveConfig } from "../src/config.js";

test("resolveConfig uses provided project dir", () => {
  const cfg = resolveConfig({ UNIVERSAL_BROWSE_PROJECT_DIR: "/tmp/demo" });
  assert.equal(cfg.projectDir, "/tmp/demo");
  assert.equal(cfg.stateDir, "/tmp/demo/.universal-browse");
  assert.equal(cfg.mode, "headless");
});

test("resolveConfig accepts headed mode", () => {
  const cfg = resolveConfig({
    UNIVERSAL_BROWSE_PROJECT_DIR: "/tmp/demo",
    UNIVERSAL_BROWSE_MODE: "headed",
  });
  assert.equal(cfg.mode, "headed");
});
