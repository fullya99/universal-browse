import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function truncate(text, max = 12000) {
  if (typeof text !== "string") return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n... [truncated]`;
}

function formatEvalResult(result) {
  if (result === undefined) return "undefined";
  if (typeof result === "string") return truncate(result);
  try {
    const json = JSON.stringify(result, null, 2);
    if (typeof json === "string") return truncate(json);
  } catch {}
  return truncate(String(result));
}

const PROFILE_LAUNCH_REGISTRY = {
  chrome: {
    displayName: "Chrome",
    dataDirByPlatform: {
      darwin: path.join("Library", "Application Support", "Google", "Chrome"),
      linux: path.join(".config", "google-chrome"),
      win32: path.join("Google", "Chrome", "User Data"),
    },
    channel: "chrome",
    executableCandidatesByPlatform: {
      darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
      linux: ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome"],
      win32: [
        path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
        path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
        path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
      ],
    },
  },
  brave: {
    displayName: "Brave",
    dataDirByPlatform: {
      darwin: path.join("Library", "Application Support", "BraveSoftware", "Brave-Browser"),
      linux: path.join(".config", "BraveSoftware", "Brave-Browser"),
      win32: path.join("BraveSoftware", "Brave-Browser", "User Data"),
    },
    executableCandidatesByPlatform: {
      darwin: ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"],
      linux: ["/usr/bin/brave-browser", "/usr/bin/brave"],
      win32: [
        path.join(process.env.LOCALAPPDATA || "", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
        path.join(process.env.PROGRAMFILES || "", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
        path.join(process.env["PROGRAMFILES(X86)"] || "", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
      ],
    },
  },
  edge: {
    displayName: "Edge",
    dataDirByPlatform: {
      darwin: path.join("Library", "Application Support", "Microsoft Edge"),
      linux: path.join(".config", "microsoft-edge"),
      win32: path.join("Microsoft", "Edge", "User Data"),
    },
    channel: "msedge",
    executableCandidatesByPlatform: {
      darwin: ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"],
      linux: ["/usr/bin/microsoft-edge", "/usr/bin/microsoft-edge-stable"],
      win32: [
        path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
      ],
    },
  },
};

const SENSITIVE_COOKIE_NAMES = new Set([
  "auth_token",
  "ct0",
  "sid",
  "sessionid",
  "token",
  "access_token",
  "refresh_token",
]);

const CHALLENGE_TITLE_PATTERNS = ["just a moment", "checking your browser", "un instant", "attention required"];

const CHALLENGE_SELECTORS = [
  "input[type='checkbox']",
  "button[type='submit']",
  "button:has-text('Verify')",
  "button:has-text('I am human')",
  "button:has-text('Continue')",
  "[data-testid='challenge-stage'] button",
  "iframe[src*='challenges.cloudflare.com']",
];

function redactCookieValue(name, value) {
  const raw = typeof value === "string" ? value : String(value ?? "");
  if (raw.length === 0) return "";
  if (SENSITIVE_COOKIE_NAMES.has(String(name || "").toLowerCase())) return "[REDACTED]";
  if (raw.length <= 8) return `${raw[0]}***${raw[raw.length - 1]}`;
  return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
}

function redactCookies(cookies) {
  if (!Array.isArray(cookies)) return [];
  return cookies.map((cookie) => ({
    ...cookie,
    value: redactCookieValue(cookie?.name, cookie?.value),
  }));
}

function isPathWithin(baseDir, targetPath) {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  const relative = path.relative(base, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function parseLaunchWithProfileArgs(args) {
  const parsed = {
    browser: "",
    profile: "Default",
  };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--profile") {
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("Usage: launch-with-profile <chrome|brave|edge> [--profile <name>]");
      }
      parsed.profile = next;
      i++;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    positional.push(arg);
  }
  if (positional.length !== 1) {
    throw new Error("Usage: launch-with-profile <chrome|brave|edge> [--profile <name>]");
  }
  parsed.browser = String(positional[0] || "").trim().toLowerCase();
  if (!PROFILE_LAUNCH_REGISTRY[parsed.browser]) {
    throw new Error("Usage: launch-with-profile <chrome|brave|edge> [--profile <name>]");
  }
  if (/[/\\]|\.\./.test(parsed.profile) || /[\x00-\x1f]/.test(parsed.profile)) {
    throw new Error(`Invalid profile name: '${parsed.profile}'`);
  }
  return parsed;
}

function getRealProfileLaunchSpec(browser, profile) {
  const spec = PROFILE_LAUNCH_REGISTRY[browser];
  if (!spec) {
    throw new Error("Usage: launch-with-profile <chrome|brave|edge> [--profile <name>]");
  }

  const dataDirSuffix = spec.dataDirByPlatform[process.platform];
  if (!dataDirSuffix) {
    throw new Error(`Real profile launch is not supported on platform: ${process.platform}`);
  }

  const profileBaseDir = process.platform === "win32"
    ? process.env.LOCALAPPDATA || process.env.APPDATA || path.join(os.homedir(), "AppData", "Local")
    : os.homedir();
  const userDataDir = path.join(profileBaseDir, dataDirSuffix);
  if (!fs.existsSync(userDataDir)) {
    throw new Error(`Browser data directory not found: ${userDataDir}`);
  }

  let executablePath = null;
  const candidates = spec.executableCandidatesByPlatform[process.platform] || [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (fs.existsSync(candidate)) {
      executablePath = candidate;
      break;
    }
  }

  return {
    displayName: spec.displayName,
    browser,
    profile,
    userDataDir,
    channel: spec.channel || null,
    executablePath,
  };
}

function formatA11y(node, depth = 0, lines = []) {
  if (!node) return lines;
  const indent = "  ".repeat(depth);
  const role = node.role || "node";
  const name = node.name ? ` \"${node.name}\"` : "";
  lines.push(`${indent}[${role}]${name}`);
  if (Array.isArray(node.children)) {
    for (const child of node.children) formatA11y(child, depth + 1, lines);
  }
  return lines;
}

function normalizeSameSite(raw) {
  if (raw === undefined || raw === null) return "Lax";
  const value = String(raw).trim().toLowerCase();
  if (value === "no_restriction" || value === "none") return "None";
  if (value === "lax") return "Lax";
  if (value === "strict") return "Strict";
  return "Lax";
}

function normalizeImportedCookie(cookie, pageUrl) {
  const next = { ...cookie };
  if (!next.domain) next.domain = pageUrl.hostname;
  if (!next.path) next.path = "/";
  next.sameSite = normalizeSameSite(next.sameSite);
  return next;
}

function isPageClosed(page) {
  if (!page) return true;
  if (typeof page.isClosed !== "function") return false;
  return page.isClosed();
}

function isContextClosed(context) {
  if (!context) return true;
  if (typeof context.isClosed !== "function") return false;
  return context.isClosed();
}

function safePageUrl(page) {
  if (!page || isPageClosed(page) || typeof page.url !== "function") return "";
  try {
    return page.url() || "";
  } catch {
    return "";
  }
}

function isRecoverableSnapshotError(message) {
  return /(page is not available|target page, context or browser has been closed|has been closed)/i.test(message);
}

async function inspectChallenge(page) {
  const title = String((await page.title().catch(() => "")) || "").trim();
  const url = String((page.url && page.url()) || "");
  const lowerTitle = title.toLowerCase();
  const titleHit = CHALLENGE_TITLE_PATTERNS.some((pattern) => lowerTitle.includes(pattern));
  const urlHit = /__cf_chl|\/cdn-cgi\/challenge-platform\//i.test(url);
  const markerHit = await page
    .evaluate(() => {
      const hasTurnstile = Boolean(document.querySelector("iframe[src*='challenges.cloudflare.com']"));
      const hasChallengeRoot = Boolean(document.querySelector("#challenge-stage, [data-testid='challenge-stage']"));
      return hasTurnstile || hasChallengeRoot;
    })
    .catch(() => false);
  return {
    isChallenge: titleHit || urlHit || markerHit,
    title,
    url,
  };
}

async function renderSnapshot(page) {
  if (!page || (typeof page.isClosed === "function" && page.isClosed())) {
    throw new Error("Page is not available");
  }

  const accessibility = page.accessibility;
  if (accessibility && typeof accessibility.snapshot === "function") {
    const tree = await accessibility.snapshot({ interestingOnly: false });
    return formatA11y(tree).join("\n");
  }

  const body = page.locator("body");
  if (body && typeof body.ariaSnapshot === "function") {
    const aria = await body.ariaSnapshot();
    return typeof aria === "string" ? aria : String(aria || "");
  }

  throw new Error("Accessibility snapshot API is unavailable in this Playwright runtime");
}

export class BrowserManager {
  constructor(strategy) {
    this.strategy = strategy;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.consoleLog = [];
    this.networkLog = [];
    this.maxLogEntries = 2000;
    this.serverPort = null;
    this.lastKnownUrl = "about:blank";
    this.realProfileSpec = null;
  }

  setServerPort(port) {
    this.serverPort = port;
  }

  getPage() {
    return this.page;
  }

  async launch() {
    const args = [];
    if (this.strategy.noSandbox) args.push("--no-sandbox");
    this.browser = await chromium.launch({
      headless: this.strategy.useHeadless,
      args,
    });
    this.context = await this.browser.newContext({ viewport: { width: 1280, height: 720 } });
    this.page = await this.context.newPage();
    this.wireEvents(this.page);
    this.lastKnownUrl = safePageUrl(this.page) || "about:blank";
    this.realProfileSpec = null;
  }

  async launchWithRealProfile(browser, profile = "Default") {
    const spec = getRealProfileLaunchSpec(browser, profile);
    const lockPath = path.join(spec.userDataDir, "SingletonLock");
    if (fs.existsSync(lockPath)) {
      throw new Error(
        `Detected lock file at ${lockPath}. Close ${spec.displayName} completely before launching with native profile.`,
      );
    }

    await this.close();

    const args = [`--profile-directory=${spec.profile}`];
    if (this.strategy.noSandbox) args.push("--no-sandbox");

    const launchOptions = {
      headless: this.strategy.useHeadless,
      args,
      viewport: { width: 1280, height: 720 },
    };
    if (spec.executablePath) launchOptions.executablePath = spec.executablePath;
    else if (spec.channel) launchOptions.channel = spec.channel;

    try {
      this.context = await chromium.launchPersistentContext(spec.userDataDir, launchOptions);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/singleton|lock|profile in use|already in use/i.test(message)) {
        throw new Error(
          `Native profile is locked by a running browser process for ${spec.displayName}. Close the browser and retry.`,
        );
      }
      throw err;
    }

    this.browser = this.context.browser();
    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
    this.wireEvents(this.page);
    this.lastKnownUrl = safePageUrl(this.page) || "about:blank";
    this.realProfileSpec = spec;

    return spec;
  }

  async ensureHeadedForChallenge() {
    if (!this.strategy.useHeadless) {
      return { switched: false, note: "already headed" };
    }

    const previousUseHeadless = this.strategy.useHeadless;
    const previousMode = this.strategy.mode;
    this.strategy.useHeadless = false;
    this.strategy.mode = "headed-native";

    try {
      if (this.realProfileSpec) {
        await this.launchWithRealProfile(this.realProfileSpec.browser, this.realProfileSpec.profile);
      } else {
        await this.close();
        await this.launch();
      }
      return { switched: true, note: "switched to headed mode for challenge handling" };
    } catch (err) {
      this.strategy.useHeadless = previousUseHeadless;
      this.strategy.mode = previousMode;
      if (!this.page) {
        try {
          await this.launch();
        } catch {}
      }
      const message = err instanceof Error ? err.message : String(err);
      return { switched: false, note: `failed to switch to headed mode: ${message}` };
    }
  }

  async solveChallengeInteractively() {
    const screenshotPath = path.join(os.tmpdir(), `universal-browse-challenge-${Date.now()}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    const clickedSelectors = [];
    for (const selector of CHALLENGE_SELECTORS) {
      try {
        const locator = this.page.locator(selector).first();
        const count = await this.page.locator(selector).count();
        if (count <= 0) continue;
        await locator.click({ timeout: 2000, force: true });
        clickedSelectors.push(selector);
      } catch {}
    }

    await this.page.waitForTimeout(2200);
    const after = await inspectChallenge(this.page);
    if (after.isChallenge) {
      return [
        `WARN: CHALLENGE_DETECTED title='${after.title || "(empty)"}'`,
        `url: ${after.url || this.page.url()}`,
        `screenshot: ${screenshotPath}`,
        `actions: ${clickedSelectors.length > 0 ? `clicked ${clickedSelectors.length} candidate elements` : "no clickable challenge element found"}`,
        "hint: use `launch-with-profile <chrome|brave|edge> --profile Default` in headed mode for manual challenge completion.",
      ].join("\n");
    }

    this.lastKnownUrl = safePageUrl(this.page) || this.lastKnownUrl;
    return [
      `OK: challenge cleared, navigated to ${this.page.url()}`,
      `screenshot: ${screenshotPath}`,
      `actions: ${clickedSelectors.length > 0 ? `clicked ${clickedSelectors.length} candidate elements` : "challenge cleared without clickable action"}`,
    ].join("\n");
  }

  wireEvents(page) {
    page.on("console", (msg) => {
      this.consoleLog.push({
        ts: Date.now(),
        level: msg.type(),
        text: msg.text(),
      });
      if (this.consoleLog.length > this.maxLogEntries) this.consoleLog.shift();
    });

    page.on("response", (res) => {
      this.networkLog.push({
        ts: Date.now(),
        status: res.status(),
        url: res.url(),
      });
      if (this.networkLog.length > this.maxLogEntries) this.networkLog.shift();
    });
  }

  async close() {
    try {
      if (this.context) await this.context.close();
    } finally {
      if (this.browser) await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  getStatus() {
    const pageClosed = isPageClosed(this.page);
    const contextClosed = isContextClosed(this.context);
    const browserConnected = Boolean(this.browser && typeof this.browser.isConnected === "function" && this.browser.isConnected());
    const liveUrl = safePageUrl(this.page);
    if (liveUrl) this.lastKnownUrl = liveUrl;
    return {
      strategy: this.strategy.mode,
      url: liveUrl || this.lastKnownUrl || "about:blank",
      pageAvailable: Boolean(this.page) && !pageClosed && !contextClosed,
      pageClosed,
      contextClosed,
      browserConnected,
    };
  }

  async recoverPageForSnapshot() {
    if (!this.context || isContextClosed(this.context)) {
      throw new Error("Page is not available");
    }

    const liveUrl = safePageUrl(this.page);
    if (liveUrl && liveUrl !== "about:blank") this.lastKnownUrl = liveUrl;

    if (!this.page || isPageClosed(this.page)) {
      this.page = await this.context.newPage();
      this.wireEvents(this.page);
    }

    const targetUrl = this.lastKnownUrl;
    if (targetUrl && targetUrl !== "about:blank") {
      try {
        await this.page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
      } catch {}
    }

    const refreshed = safePageUrl(this.page);
    if (refreshed) this.lastKnownUrl = refreshed;
  }

  async exec(command, args) {
    if (!this.page) throw new Error("Browser not ready");
    switch (command) {
      case "status":
        return this.getStatus();
      case "goto": {
        const url = args[0];
        if (!url) throw new Error("Usage: goto <url>");
        await this.page.goto(url, { waitUntil: "domcontentloaded" });
        this.lastKnownUrl = safePageUrl(this.page) || this.lastKnownUrl;
        let challenge = await inspectChallenge(this.page);
        if (!challenge.isChallenge) return `OK: navigated to ${this.page.url()}`;

        const switchResult = await this.ensureHeadedForChallenge();
        if (switchResult.switched) {
          await this.page.goto(url, { waitUntil: "domcontentloaded" });
          this.lastKnownUrl = safePageUrl(this.page) || this.lastKnownUrl;
          challenge = await inspectChallenge(this.page);
          if (!challenge.isChallenge) {
            return `OK: navigated to ${this.page.url()}\nINFO: ${switchResult.note}`;
          }
          const solved = await this.solveChallengeInteractively();
          return `INFO: ${switchResult.note}\n${solved}`;
        }

        const solved = await this.solveChallengeInteractively();
        return `INFO: ${switchResult.note}\n${solved}`;
      }
      case "text": {
        const text = await this.page.locator("body").innerText();
        return truncate(text);
      }
      case "snapshot": {
        try {
          return await renderSnapshot(this.page);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!isRecoverableSnapshotError(msg)) {
            throw new Error(`Snapshot failed: ${msg}`);
          }
          try {
            await this.recoverPageForSnapshot();
            return await renderSnapshot(this.page);
          } catch (retryErr) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            throw new Error(`Snapshot failed after recovery: ${retryMsg}`);
          }
        }
      }
      case "click": {
        const selector = args[0];
        if (!selector) throw new Error("Usage: click <selector>");
        await this.page.locator(selector).first().click();
        return `OK: clicked ${selector}`;
      }
      case "fill": {
        const selector = args[0];
        const value = args.slice(1).join(" ");
        if (!selector || value.length === 0) throw new Error("Usage: fill <selector> <value>");
        await this.page.locator(selector).first().fill(value);
        return `OK: filled ${selector}`;
      }
      case "wait": {
        const ms = Number(args[0] || "0");
        if (!Number.isFinite(ms) || ms < 0) throw new Error("Usage: wait <ms>");
        await this.page.waitForTimeout(ms);
        return `OK: waited ${ms}ms`;
      }
      case "scroll": {
        const direction = String(args[0] || "").toLowerCase();
        const pixels = Number(args[1] || "0");
        if ((direction !== "up" && direction !== "down") || !Number.isFinite(pixels) || pixels <= 0) {
          throw new Error("Usage: scroll <up|down> <pixels>");
        }
        const delta = direction === "up" ? -pixels : pixels;
        const result = await this.page.evaluate((nextDelta) => {
          const before = Math.round(window.scrollY || window.pageYOffset || 0);
          window.scrollBy(0, nextDelta);
          const after = Math.round(window.scrollY || window.pageYOffset || 0);
          return { before, after };
        }, delta);
        if (result.before === result.after) {
          return `OK: scroll limit reached (y=${result.after})`;
        }
        return `OK: scrolled ${direction} ${pixels}px (y=${result.after})`;
      }
      case "eval": {
        const expression = args.join(" ").trim();
        if (!expression) throw new Error("Usage: eval <js expression>");
        try {
          const result = await this.page.evaluate((source) => (0, eval)(source), expression);
          return formatEvalResult(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (/Execution context was destroyed/i.test(message)) {
            return "WARN: context_destroyed - page may still be navigating";
          }
          throw err;
        }
      }
      case "viewport": {
        const raw = args[0] || "";
        const m = raw.match(/^(\d+)x(\d+)$/);
        if (!m) throw new Error("Usage: viewport <width>x<height>");
        await this.page.setViewportSize({ width: Number(m[1]), height: Number(m[2]) });
        return `OK: viewport ${raw}`;
      }
      case "screenshot": {
        const outPath = args[0] || path.join(os.tmpdir(), `universal-browse-${Date.now()}.png`);
        await this.page.screenshot({ path: outPath, fullPage: true });
        return `OK: screenshot ${outPath}`;
      }
      case "cookies":
        return redactCookies(await this.page.context().cookies());
      case "cookie-import": {
        const allowPlaintext = args.includes("--allow-plaintext-cookies");
        const positionalArgs = args.filter((arg) => arg !== "--allow-plaintext-cookies");
        const filePath = positionalArgs[0];
        if (!filePath) throw new Error("Usage: cookie-import <json-file>");
        const resolved = path.resolve(filePath);
        const safeDirs = [os.tmpdir(), process.cwd()];
        const isSafe = safeDirs.some((dir) => isPathWithin(dir, resolved));
        if (!isSafe) throw new Error(`Path must be within: ${safeDirs.join(", ")}`);
        if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`);

        if (process.env.UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK === "1" && !allowPlaintext) {
          throw new Error(
            "Plaintext cookie import requires explicit acknowledgement. Re-run with --allow-plaintext-cookies",
          );
        }

        const raw = fs.readFileSync(resolved, "utf8");
        let cookies;
        try {
          cookies = JSON.parse(raw);
        } catch {
          throw new Error(`Invalid JSON in ${resolved}`);
        }
        if (!Array.isArray(cookies)) throw new Error("Cookie file must contain a JSON array");

        const pageUrl = new URL(this.page.url());
        for (const cookie of cookies) {
          if (!cookie?.name || cookie?.value === undefined) {
            throw new Error("Each cookie must include name and value");
          }
        }
        const normalizedCookies = cookies.map((cookie) => normalizeImportedCookie(cookie, pageUrl));
        await this.page.context().addCookies(normalizedCookies);
        return `OK: loaded ${cookies.length} cookies from ${resolved}\nWARNING: cookie files may contain live session secrets; delete file after import.`;
      }
      case "cookie-import-browser": {
        throw new Error(
          "cookie-import-browser has been retired for reliability reasons. Use launch-with-profile <chrome|brave|edge> --profile <name>.",
        );
      }
      case "launch-with-profile": {
        const parsed = parseLaunchWithProfileArgs(args);
        this.strategy.useHeadless = false;
        this.strategy.mode = "headed-native";
        const spec = await this.launchWithRealProfile(parsed.browser, parsed.profile);
        return [
          `OK: launched ${spec.displayName} native profile '${spec.profile}'`,
          `userDataDir: ${spec.userDataDir}`,
          "WARNING: this mode reuses your real browser profile and may expose live authenticated sessions/logged data to the automation context.",
        ].join("\n");
      }
      case "console":
        return this.consoleLog;
      case "network":
        return this.networkLog;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }
}
