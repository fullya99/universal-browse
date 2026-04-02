import test from "node:test";
import assert from "node:assert/strict";
import { getDisplayStrategy } from "../src/display-strategy.js";

test("headless strategy on linux", () => {
  const result = getDisplayStrategy({
    platform: "linux",
    mode: "headless",
    env: {},
  });
  assert.equal(result.useHeadless, true);
  assert.equal(result.mode, "headless-native");
});

test("headed mode with display is native", () => {
  const result = getDisplayStrategy({
    platform: "linux",
    mode: "headed",
    env: { DISPLAY: ":0" },
  });
  assert.equal(result.mode, "headed-native");
  assert.equal(result.wrapWithXvfb, false);
});
