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
