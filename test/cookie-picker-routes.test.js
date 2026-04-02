import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import Database from "better-sqlite3";
import { handleCookiePickerRoute } from "../src/cookie-picker-routes.js";

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

function withTempLinuxConfig(t, run) {
  const previous = {
    HOME: process.env.HOME,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    APPDATA: process.env.APPDATA,
    USERPROFILE: process.env.USERPROFILE,
  };

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "universal-browse-picker-test-"));
  process.env.HOME = root;
  process.env.USERPROFILE = root;
  delete process.env.LOCALAPPDATA;
  delete process.env.APPDATA;

  t.after(() => {
    if (previous.HOME === undefined) delete process.env.HOME;
    else process.env.HOME = previous.HOME;

    if (previous.LOCALAPPDATA === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previous.LOCALAPPDATA;

    if (previous.APPDATA === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = previous.APPDATA;

    if (previous.USERPROFILE === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previous.USERPROFILE;

    fs.rmSync(root, { recursive: true, force: true });
  });

  return run(root);
}

function makeReq(method, headers = {}, body = "") {
  const req = Readable.from(body ? [Buffer.from(body)] : []);
  req.method = method;
  req.headers = headers;
  return req;
}

function makeRes() {
  return {
    status: 0,
    headers: {},
    body: "",
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers || {};
    },
    end(payload = "") {
      this.body = String(payload);
    },
  };
}

test("/cookie-picker/debug returns profiles and domains for valid browser", async (t) => {
  await withTempLinuxConfig(t, async (root) => {
    const browserDir = path.join(root, ".config", "BraveSoftware", "Brave-Browser");
    const dbPath = path.join(browserDir, "Default", "Network", "Cookies");
    createCookieDb(dbPath, [".x.com", ".x.com", ".twitter.com"]);

    const req = makeReq("GET", { authorization: "Bearer test-token" });
    const res = makeRes();
    const url = new URL("http://127.0.0.1:9400/cookie-picker/debug?browser=brave&profile=Default");
    const manager = { getPage() { return null; } };

    await handleCookiePickerRoute(req, res, url, manager, "test-token");

    assert.equal(res.status, 200);
    const payload = JSON.parse(res.body);
    assert.equal(payload.browserName, "brave");
    assert.equal(payload.profile, "Default");
    assert.deepEqual(payload.errors, []);
    assert.ok(Array.isArray(payload.profiles));
    assert.ok(payload.profiles.some((p) => p.name === "Default"));
    assert.ok(Array.isArray(payload.domains?.domains));
    assert.deepEqual(
      payload.domains.domains.map((row) => [row.domain, row.count]),
      [[".x.com", 2], [".twitter.com", 1]],
    );
  });
});

test("/cookie-picker/debug reports profile and domain errors for unknown browser", async () => {
  const req = makeReq("GET", { authorization: "Bearer test-token" });
  const res = makeRes();
  const url = new URL("http://127.0.0.1:9400/cookie-picker/debug?browser=nope");
  const manager = { getPage() { return null; } };

  await handleCookiePickerRoute(req, res, url, manager, "test-token");

  assert.equal(res.status, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.browserName, "nope");
  assert.ok(Array.isArray(payload.errors));
  assert.ok(payload.errors.some((e) => e.scope === "profiles"));
  assert.ok(payload.errors.some((e) => e.scope === "domains"));
});
