import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  findInstalledBrowsers,
  importCookies,
  listSupportedBrowserNames,
} from "./cookie-import-browser.js";

function truncate(text, max = 12000) {
  if (typeof text !== "string") return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n... [truncated]`;
}

function isPathWithin(baseDir, targetPath) {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  const relative = path.relative(base, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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
    return {
      strategy: this.strategy.mode,
      url: this.page ? this.page.url() : "about:blank",
    };
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
        return `OK: navigated to ${this.page.url()}`;
      }
      case "text": {
        const text = await this.page.locator("body").innerText();
        return truncate(text);
      }
      case "snapshot": {
        const tree = await this.page.accessibility.snapshot({ interestingOnly: false });
        return formatA11y(tree).join("\n");
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
        return await this.page.context().cookies();
      case "cookie-import": {
        const filePath = args[0];
        if (!filePath) throw new Error("Usage: cookie-import <json-file>");
        const resolved = path.resolve(filePath);
        const safeDirs = [os.tmpdir(), process.cwd()];
        const isSafe = safeDirs.some((dir) => isPathWithin(dir, resolved));
        if (!isSafe) throw new Error(`Path must be within: ${safeDirs.join(", ")}`);
        if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`);
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
          if (!cookie.domain) cookie.domain = pageUrl.hostname;
          if (!cookie.path) cookie.path = "/";
        }
        await this.page.context().addCookies(cookies);
        return `OK: loaded ${cookies.length} cookies from ${resolved}`;
      }
      case "cookie-import-browser": {
        const browserArg = args[0] || "chrome";
        const domainIdx = args.indexOf("--domain");
        const profileIdx = args.indexOf("--profile");
        const profile = profileIdx !== -1 && profileIdx + 1 < args.length ? args[profileIdx + 1] : "Default";

        if (domainIdx !== -1 && domainIdx + 1 < args.length) {
          const domain = args[domainIdx + 1];
          const result = await importCookies(browserArg, [domain], profile);
          if (result.cookies.length > 0) await this.page.context().addCookies(result.cookies);
          return `OK: imported ${result.count} cookies for ${domain} from ${browserArg}${result.failed ? ` (${result.failed} failed)` : ""}`;
        }

        const browsers = findInstalledBrowsers();
        if (browsers.length === 0) {
          throw new Error(`No Chromium browsers found. Supported: ${listSupportedBrowserNames().join(", ")}`);
        }
        if (!this.serverPort) throw new Error("Server port not available");
        const pickerUrl = `http://127.0.0.1:${this.serverPort}/cookie-picker`;
        try {
          const openSpec =
            process.platform === "darwin"
              ? { command: "open", args: [pickerUrl] }
              : process.platform === "win32"
                ? { command: "cmd", args: ["/c", "start", "", pickerUrl] }
                : { command: "xdg-open", args: [pickerUrl] };
          const child = spawn(openSpec.command, openSpec.args, { detached: true, stdio: "ignore" });
          child.unref();
        } catch {}

        return `Cookie picker opened at ${pickerUrl}\nDetected browsers: ${browsers.map((b) => b.name).join(", ")}`;
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
