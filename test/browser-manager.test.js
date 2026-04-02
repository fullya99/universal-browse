import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BrowserManager } from "../src/browser-manager.js";

test("cookies command redacts sensitive cookie values", async () => {
  const manager = new BrowserManager({ mode: "headless", useHeadless: true, noSandbox: false });
  manager.page = {
    context() {
      return {
        async cookies() {
          return [
            { name: "auth_token", value: "1234567890abcdef", domain: ".x.com", path: "/" },
            { name: "pref", value: "abcdef", domain: ".x.com", path: "/" },
          ];
        },
      };
    },
  };

  const output = await manager.exec("cookies", []);
  assert.equal(output[0].value, "[REDACTED]");
  assert.equal(output[1].value, "a***f");
  assert.equal(output[0].domain, ".x.com");
});

test("cookie-import warns on plaintext cookie files", async (t) => {
  const filePath = path.join(os.tmpdir(), `universal-browse-cookie-import-${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify([{ name: "session", value: "abc", domain: ".example.com", path: "/" }]));
  t.after(() => {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  });

  let imported = [];
  const manager = new BrowserManager({ mode: "headless", useHeadless: true, noSandbox: false });
  manager.page = {
    url() {
      return "https://example.com";
    },
    context() {
      return {
        async addCookies(cookies) {
          imported = cookies;
        },
      };
    },
  };

  const output = await manager.exec("cookie-import", [filePath]);
  assert.equal(imported.length, 1);
  assert.match(output, /WARNING: cookie files may contain live session secrets/);
});

test("cookie-import normalizes Cookie-Editor sameSite values", async (t) => {
  const filePath = path.join(os.tmpdir(), `universal-browse-cookie-import-${Date.now()}.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify([
      { name: "a", value: "1", domain: ".example.com", path: "/", sameSite: "no_restriction" },
      { name: "b", value: "2", domain: ".example.com", path: "/", sameSite: "strict" },
      { name: "c", value: "3", domain: ".example.com", path: "/", sameSite: "weird" },
      { name: "d", value: "4", domain: ".example.com", path: "/", sameSite: null },
    ]),
  );
  t.after(() => {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  });

  let imported = [];
  const manager = new BrowserManager({ mode: "headless", useHeadless: true, noSandbox: false });
  manager.page = {
    url() {
      return "https://example.com";
    },
    context() {
      return {
        async addCookies(cookies) {
          imported = cookies;
        },
      };
    },
  };

  await manager.exec("cookie-import", [filePath]);
  assert.deepEqual(imported.map((c) => c.sameSite), ["None", "Strict", "Lax", "Lax"]);
});

test("cookie-import strict mode requires explicit acknowledgement flag", async (t) => {
  const previous = process.env.UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK;
  process.env.UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK = "1";
  t.after(() => {
    if (previous === undefined) delete process.env.UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK;
    else process.env.UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK = previous;
  });

  const filePath = path.join(os.tmpdir(), `universal-browse-cookie-import-${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify([{ name: "session", value: "abc", domain: ".example.com", path: "/" }]));
  t.after(() => {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  });

  const manager = new BrowserManager({ mode: "headless", useHeadless: true, noSandbox: false });
  manager.page = {
    url() {
      return "https://example.com";
    },
    context() {
      return {
        async addCookies() {},
      };
    },
  };

  await assert.rejects(
    manager.exec("cookie-import", [filePath]),
    /Plaintext cookie import requires explicit acknowledgement/,
  );

  const allowed = await manager.exec("cookie-import", [filePath, "--allow-plaintext-cookies"]);
  assert.match(allowed, /OK: loaded 1 cookies/);
});

test("cookie-import-browser rejects unknown flags", async () => {
  const manager = new BrowserManager({ mode: "headless", useHeadless: true, noSandbox: false });
  manager.page = {
    context() {
      return {
        async addCookies() {},
      };
    },
  };

  await assert.rejects(manager.exec("cookie-import-browser", ["--unknown-flag"]), /Unknown flag/);
});

test("scroll command scrolls in requested direction", async () => {
  const manager = new BrowserManager({ mode: "headless", useHeadless: true, noSandbox: false });
  manager.page = {
    async evaluate(_fn, delta) {
      return delta > 0 ? 250 : 130;
    },
  };

  const down = await manager.exec("scroll", ["down", "250"]);
  assert.match(down, /OK: scrolled down 250px/);

  const up = await manager.exec("scroll", ["up", "120"]);
  assert.match(up, /OK: scrolled up 120px/);
});

test("eval command evaluates expression", async () => {
  const manager = new BrowserManager({ mode: "headless", useHeadless: true, noSandbox: false });
  manager.page = {
    async evaluate(fn, source) {
      return fn(source);
    },
  };

  const output = await manager.exec("eval", ["1", "+", "2"]);
  assert.equal(output, "3");
});

test("launch-with-profile validates and relaunches with native profile", async () => {
  const manager = new BrowserManager({ mode: "headless", useHeadless: true, noSandbox: false });
  manager.page = {};
  let captured = null;
  manager.launchWithRealProfile = async (browser, profile) => {
    captured = { browser, profile };
    return {
      displayName: "Brave",
      profile,
      userDataDir: "/tmp/fake-profile",
    };
  };

  const output = await manager.exec("launch-with-profile", ["brave", "--profile", "Default"]);
  assert.deepEqual(captured, { browser: "brave", profile: "Default" });
  assert.match(output, /OK: launched Brave native profile 'Default'/);
  assert.match(output, /WARNING: this mode reuses your real browser profile/);
});

test("launch-with-profile rejects unknown flags", async () => {
  const manager = new BrowserManager({ mode: "headless", useHeadless: true, noSandbox: false });
  manager.page = {};
  await assert.rejects(
    manager.exec("launch-with-profile", ["brave", "--unknown"]),
    /Unknown flag/,
  );
});

test("snapshot retries once by recreating page when closed", async () => {
  const manager = new BrowserManager({ mode: "headless", useHeadless: true, noSandbox: false });

  const recoveredPage = {
    _closed: false,
    isClosed() {
      return this._closed;
    },
    url() {
      return "https://example.com";
    },
    locator() {
      return {
        ariaSnapshot() {
          return "[document]";
        },
      };
    },
    on() {},
    async goto() {},
  };

  manager.page = {
    isClosed() {
      return true;
    },
  };
  manager.context = {
    isClosed() {
      return false;
    },
    async newPage() {
      return recoveredPage;
    },
  };
  manager.lastKnownUrl = "https://example.com";

  const snap = await manager.exec("snapshot", []);
  assert.match(snap, /\[document\]/);
});
