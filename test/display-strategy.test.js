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

test("headed mode on windows is native", () => {
  const result = getDisplayStrategy({
    platform: "win32",
    mode: "headed",
    env: {},
  });
  assert.equal(result.mode, "headed-native");
  assert.equal(result.wrapWithXvfb, false);
});

test("extraArgs includes common fast-launch flags", () => {
  const result = getDisplayStrategy({
    platform: "darwin",
    mode: "headless",
    env: {},
  });
  assert.ok(Array.isArray(result.extraArgs));
  assert.ok(result.extraArgs.includes("--no-first-run"));
  assert.ok(result.extraArgs.includes("--disable-extensions"));
  assert.ok(!result.extraArgs.includes("--disable-gpu"));
});

test("extraArgs includes --disable-gpu on windows", () => {
  const result = getDisplayStrategy({
    platform: "win32",
    mode: "headless",
    env: {},
  });
  assert.ok(result.extraArgs.includes("--disable-gpu"));
});

test("extraArgs includes --disable-gpu on linux without display", () => {
  const result = getDisplayStrategy({
    platform: "linux",
    mode: "headless",
    env: {},
  });
  assert.ok(result.extraArgs.includes("--disable-gpu"));
  assert.ok(result.extraArgs.includes("--disable-software-rasterizer"));
});

test("extraArgs omits --disable-gpu on linux with display", () => {
  const result = getDisplayStrategy({
    platform: "linux",
    mode: "headed",
    env: { DISPLAY: ":0" },
  });
  assert.ok(!result.extraArgs.includes("--disable-gpu"));
});
