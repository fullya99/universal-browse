import { spawnSync } from "node:child_process";

function hasProgram(name) {
  const lookupCmd = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(lookupCmd, [name], {
    stdio: ["ignore", "ignore", "ignore"],
    timeout: 1000,
  });
  return r.status === 0;
}

function isContainer(env) {
  if (env.CONTAINER || env.CI) return true;
  if (env.DOCKER_CONTAINER) return true;
  return false;
}

export function getDisplayStrategy({ env = process.env, platform = process.platform, mode = "headless" } = {}) {
  const hasDisplay = Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
  const xvfbEnabled = env.UNIVERSAL_BROWSE_XVFB !== "0";
  const canUseXvfb = platform === "linux" && xvfbEnabled && hasProgram("xvfb-run");

  if (mode === "headless") {
    return {
      mode: "headless-native",
      useHeadless: true,
      wrapWithXvfb: false,
      noSandbox: isContainer(env),
    };
  }

  if (platform === "linux" && !hasDisplay) {
    if (canUseXvfb) {
      return {
        mode: "headed-xvfb",
        useHeadless: false,
        wrapWithXvfb: true,
        noSandbox: isContainer(env),
      };
    }
    return {
      mode: "headed-missing-display",
      useHeadless: false,
      wrapWithXvfb: false,
      noSandbox: isContainer(env),
      error:
        "Headed mode requires DISPLAY/WAYLAND_DISPLAY or xvfb-run. Install xvfb or use headless mode.",
    };
  }

  return {
    mode: "headed-native",
    useHeadless: false,
    wrapWithXvfb: false,
    noSandbox: isContainer(env),
  };
}
