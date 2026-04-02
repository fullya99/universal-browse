import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import {
  CookieImportError,
  findInstalledBrowsers,
  importCookies,
  listDomains,
  listProfiles,
  listSupportedBrowserNames,
} from "../src/cookie-import-browser.js";

test("supported browser list is non-empty", () => {
  const names = listSupportedBrowserNames();
  assert.ok(Array.isArray(names));
  assert.ok(names.length > 0);
});

function withTempWindowsAppData(t, run) {
  const previous = {
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    APPDATA: process.env.APPDATA,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
  };

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "universal-browse-test-"));
  process.env.LOCALAPPDATA = root;
  delete process.env.APPDATA;
  process.env.HOME = root;
  process.env.USERPROFILE = root;

  t.after(() => {
    if (previous.LOCALAPPDATA === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previous.LOCALAPPDATA;

    if (previous.APPDATA === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = previous.APPDATA;

    if (previous.HOME === undefined) delete process.env.HOME;
    else process.env.HOME = previous.HOME;

    if (previous.USERPROFILE === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previous.USERPROFILE;

    fs.rmSync(root, { recursive: true, force: true });
  });

  return run(root);
}

function withTempLinuxConfig(t, run) {
  const previous = {
    HOME: process.env.HOME,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    APPDATA: process.env.APPDATA,
  };

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "universal-browse-linux-test-"));
  process.env.HOME = root;
  delete process.env.LOCALAPPDATA;
  delete process.env.APPDATA;

  t.after(() => {
    if (previous.HOME === undefined) delete process.env.HOME;
    else process.env.HOME = previous.HOME;

    if (previous.LOCALAPPDATA === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previous.LOCALAPPDATA;

    if (previous.APPDATA === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = previous.APPDATA;

    fs.rmSync(root, { recursive: true, force: true });
  });

  return run(root);
}

function createCookieDb(dbPath, domains = [".x.com"]) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE cookies (
      host_key TEXT,
      name TEXT,
      value TEXT,
      encrypted_value BLOB,
      path TEXT,
      is_secure INTEGER,
      is_httponly INTEGER,
      has_expires INTEGER,
      expires_utc INTEGER,
      samesite INTEGER
    );
  `);
  const stmt = db.prepare(
    `INSERT INTO cookies
      (host_key, name, value, encrypted_value, path, is_secure, is_httponly, has_expires, expires_utc, samesite)
     VALUES
      (?, ?, ?, X'', '/', 1, 1, 0, 0, 1)`,
  );
  let idx = 0;
  for (const domain of domains) {
    idx += 1;
    stmt.run(domain, `cookie_${idx}`, `value_${idx}`);
  }
  db.close();
}

test("listProfiles detects Brave profile when only Network/Cookies exists", (t) => {
  withTempWindowsAppData(t, (root) => {
    const browserDir = path.join(root, "BraveSoftware", "Brave-Browser", "User Data");
    const dbPath = path.join(browserDir, "Default", "Network", "Cookies");
    createCookieDb(dbPath);

    const profiles = listProfiles("brave");
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].name, "Default");
  });
});

test("findInstalledBrowsers detects Brave from Profile N Network/Cookies", (t) => {
  withTempWindowsAppData(t, (root) => {
    const browserDir = path.join(root, "BraveSoftware", "Brave-Browser", "User Data");
    const dbPath = path.join(browserDir, "Profile 7", "Network", "Cookies");
    createCookieDb(dbPath);

    const installed = findInstalledBrowsers().map((b) => b.name);
    assert.ok(installed.includes("Brave"));
  });
});

test("listDomains reads Brave database from Network/Cookies path", async (t) => {
  await withTempWindowsAppData(t, async (root) => {
    const browserDir = path.join(root, "BraveSoftware", "Brave-Browser", "User Data");
    const dbPath = path.join(browserDir, "Default", "Network", "Cookies");
    createCookieDb(dbPath, [".x.com", ".twitter.com", ".x.com"]);

    const result = await listDomains("brave", "Default");
    const rows = result.domains.map((row) => [row.domain, row.count]);
    assert.deepEqual(rows, [[".x.com", 2], [".twitter.com", 1]]);
  });
});

test("listDomains returns db_locked when cookie DB cannot be copied", async (t) => {
  await withTempWindowsAppData(t, async (root) => {
    const invalidDbPath = path.join(root, "BraveSoftware", "Brave-Browser", "User Data", "Default", "Network", "Cookies");
    fs.mkdirSync(invalidDbPath, { recursive: true });

    await assert.rejects(
      listDomains("brave", "Default"),
      (err) => err instanceof CookieImportError && err.code === "db_locked",
    );
  });
});

test("listProfiles includes non-standard profile directory names", (t) => {
  withTempWindowsAppData(t, (root) => {
    const browserDir = path.join(root, "BraveSoftware", "Brave-Browser", "User Data");
    const dbPath = path.join(browserDir, "Work Profile", "Network", "Cookies");
    createCookieDb(dbPath);

    const profiles = listProfiles("brave");
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].name, "Work Profile");
  });
});

test("importCookies matches dotted and non-dotted domain inputs", async (t) => {
  await withTempLinuxConfig(t, async (root) => {
    const browserDir = path.join(root, ".config", "BraveSoftware", "Brave-Browser");
    const dbPath = path.join(browserDir, "Default", "Network", "Cookies");
    createCookieDb(dbPath, [".example.com"]);

    const plainHost = await importCookies("brave", ["example.com"], "Default");
    assert.equal(plainHost.count, 1);

    const dottedHost = await importCookies("brave", [".example.com"], "Default");
    assert.equal(dottedHost.count, 1);

    const urlHost = await importCookies("brave", ["https://example.com/path"], "Default");
    assert.equal(urlHost.count, 1);
  });
});

test("importCookies retries twitter.com with x.com alias", async (t) => {
  await withTempLinuxConfig(t, async (root) => {
    const browserDir = path.join(root, ".config", "BraveSoftware", "Brave-Browser");
    const dbPath = path.join(browserDir, "Default", "Network", "Cookies");
    createCookieDb(dbPath, [".x.com"]);

    const result = await importCookies("brave", ["twitter.com"], "Default");
    assert.equal(result.count, 1);
    assert.match(result.aliasNote || "", /x\.com alias/);
  });
});

test("importCookies returns abe_unsupported when app_bound key exists on Windows", async (t) => {
  await withTempWindowsAppData(t, async (root) => {
    const browserRoot = path.join(root, "BraveSoftware", "Brave-Browser", "User Data");
    const dbPath = path.join(browserRoot, "Default", "Network", "Cookies");
    createCookieDb(dbPath, [".x.com"]);

    fs.writeFileSync(
      path.join(browserRoot, "Local State"),
      JSON.stringify(
        {
          os_crypt: {
            app_bound_encrypted_key: "dummy",
            encrypted_key: Buffer.from("DPAPIdummy").toString("base64"),
          },
        },
        null,
        2,
      ),
    );

    await assert.rejects(
      importCookies("brave", ["x.com"], "Default"),
      (err) => err instanceof CookieImportError && err.code === "abe_unsupported",
    );
  });
});
