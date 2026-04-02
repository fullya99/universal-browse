import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class CookieImportError extends Error {
  constructor(message, code, action) {
    super(message);
    this.name = "CookieImportError";
    this.code = code;
    this.action = action;
  }
}

const BROWSER_REGISTRY = [
  { name: "Comet", dataDir: "Comet/", keychainService: "Comet Safe Storage", aliases: ["comet", "perplexity"] },
  {
    name: "Chrome",
    dataDir: "Google/Chrome/",
    keychainService: "Chrome Safe Storage",
    aliases: ["chrome", "google-chrome", "google-chrome-stable"],
    linuxDataDir: "google-chrome/",
    linuxApplication: "chrome",
    windowsDataDir: "Google/Chrome/User Data/",
  },
  {
    name: "Chromium",
    dataDir: "chromium/",
    keychainService: "Chromium Safe Storage",
    aliases: ["chromium"],
    linuxDataDir: "chromium/",
    linuxApplication: "chromium",
    windowsDataDir: "Chromium/User Data/",
  },
  { name: "Arc", dataDir: "Arc/User Data/", keychainService: "Arc Safe Storage", aliases: ["arc"] },
  {
    name: "Brave",
    dataDir: "BraveSoftware/Brave-Browser/",
    keychainService: "Brave Safe Storage",
    aliases: ["brave"],
    linuxDataDir: "BraveSoftware/Brave-Browser/",
    linuxApplication: "brave",
    windowsDataDir: "BraveSoftware/Brave-Browser/User Data/",
  },
  {
    name: "Edge",
    dataDir: "Microsoft Edge/",
    keychainService: "Microsoft Edge Safe Storage",
    aliases: ["edge"],
    linuxDataDir: "microsoft-edge/",
    linuxApplication: "microsoft-edge",
    windowsDataDir: "Microsoft/Edge/User Data/",
  },
];

const CHROMIUM_EPOCH_OFFSET = 11644473600000000n;
const keyCache = new Map();

let BetterSqlite3 = null;

async function getSqliteModule() {
  if (BetterSqlite3) return BetterSqlite3;
  try {
    const mod = await import("better-sqlite3");
    BetterSqlite3 = mod.default;
    return BetterSqlite3;
  } catch {
    throw new CookieImportError(
      "Missing dependency better-sqlite3. Run: npm install",
      "sqlite_missing",
      "retry",
    );
  }
}

function getHostPlatform() {
  if (process.platform === "darwin" || process.platform === "linux" || process.platform === "win32") {
    return process.platform;
  }
  return null;
}

function getSearchPlatforms() {
  const current = getHostPlatform();
  const order = [];
  if (current) order.push(current);
  for (const p of ["darwin", "linux", "win32"]) {
    if (!order.includes(p)) order.push(p);
  }
  return order;
}

function getDataDirForPlatform(browser, platform) {
  if (platform === "darwin") return browser.dataDir;
  if (platform === "linux") return browser.linuxDataDir || null;
  if (platform === "win32") return browser.windowsDataDir || null;
  return null;
}

function getBaseDir(platform) {
  if (platform === "darwin") return path.join(os.homedir(), "Library", "Application Support");
  if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    const appData = process.env.APPDATA;
    if (localAppData && localAppData.length > 0) return localAppData;
    if (appData && appData.length > 0) return appData;
    return path.join(os.homedir(), "AppData", "Local");
  }
  return path.join(os.homedir(), ".config");
}

function resolveBrowser(nameOrAlias) {
  const needle = String(nameOrAlias || "").toLowerCase().trim();
  const found = BROWSER_REGISTRY.find(
    (b) => b.aliases.includes(needle) || b.name.toLowerCase() === needle,
  );
  if (!found) {
    const supported = BROWSER_REGISTRY.flatMap((b) => b.aliases).join(", ");
    throw new CookieImportError(`Unknown browser '${nameOrAlias}'. Supported: ${supported}`, "unknown_browser");
  }
  return found;
}

function validateProfile(profile) {
  if (/[/\\]|\.\./.test(profile) || /[\x00-\x1f]/.test(profile)) {
    throw new CookieImportError(`Invalid profile name: '${profile}'`, "bad_request");
  }
}

function getCookieDbCandidates(baseDir, dataDir, profile) {
  const profileDir = path.join(baseDir, dataDir, profile);
  return [
    path.join(profileDir, "Cookies"),
    path.join(profileDir, "Network", "Cookies"),
  ];
}

function getCookieDbCandidatesFromProfileDir(profileDir) {
  return [
    path.join(profileDir, "Cookies"),
    path.join(profileDir, "Network", "Cookies"),
  ];
}

function normalizeDomainInput(domain) {
  const raw = String(domain || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("://")) {
    try {
      return new URL(raw).hostname.toLowerCase();
    } catch {
      return "";
    }
  }
  return raw.replace(/\/+$/, "");
}

function expandDomainCandidates(domains) {
  const candidates = new Set();
  for (const input of domains) {
    const normalized = normalizeDomainInput(input);
    if (!normalized) continue;
    candidates.add(normalized);
    if (normalized.startsWith(".")) candidates.add(normalized.slice(1));
    else candidates.add(`.${normalized}`);
  }
  return [...candidates];
}

function findBrowserMatch(browser, profile) {
  validateProfile(profile);
  for (const platform of getSearchPlatforms()) {
    const dataDir = getDataDirForPlatform(browser, platform);
    if (!dataDir) continue;
    const baseDir = getBaseDir(platform);
    const candidates = getCookieDbCandidates(baseDir, dataDir, profile);
    for (const dbPath of candidates) {
      try {
        if (fs.existsSync(dbPath)) return { browser, platform, dbPath };
      } catch {}
    }
  }
  return null;
}

function getBrowserMatch(browser, profile) {
  const match = findBrowserMatch(browser, profile);
  if (match) return match;

  const attempted = getSearchPlatforms()
    .map((platform) => {
      const dataDir = getDataDirForPlatform(browser, platform);
      if (!dataDir) return null;
      return getCookieDbCandidates(getBaseDir(platform), dataDir, profile);
    })
    .flat()
    .filter(Boolean);

  throw new CookieImportError(
    `${browser.name} is not installed (no cookie database at ${attempted.join(" or ")})`,
    "not_installed",
  );
}

async function openDb(dbPath, browserName) {
  const Sqlite = await getSqliteModule();
  try {
    const db = new Sqlite(dbPath, { readonly: true, fileMustExist: true });
    db.pragma("busy_timeout = 5000");
    return { db, copied: false, tmpPath: null };
  } catch (err) {
    const msg = String(err?.message || err);
    if (
      msg.includes("SQLITE_BUSY") ||
      msg.includes("database is locked") ||
      msg.includes("unable to open database file") ||
      msg.toLowerCase().includes("disk i/o error")
    ) {
      return openDbFromCopy(dbPath, browserName);
    }
    if (msg.includes("SQLITE_CORRUPT") || msg.includes("malformed")) {
      throw new CookieImportError(`Cookie database for ${browserName} is corrupt`, "db_corrupt");
    }
    throw err;
  }
}

async function openDbFromCopy(dbPath, browserName) {
  const Sqlite = await getSqliteModule();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const tmpPath = path.join(
      os.tmpdir(),
      `universal-browse-cookies-${browserName.toLowerCase()}-${crypto.randomUUID()}.db`,
    );
    try {
      fs.copyFileSync(dbPath, tmpPath);
      const walPath = `${dbPath}-wal`;
      const shmPath = `${dbPath}-shm`;
      if (fs.existsSync(walPath)) fs.copyFileSync(walPath, `${tmpPath}-wal`);
      if (fs.existsSync(shmPath)) fs.copyFileSync(shmPath, `${tmpPath}-shm`);
      const db = new Sqlite(tmpPath, { readonly: true, fileMustExist: true });
      db.pragma("busy_timeout = 5000");
      return { db, copied: true, tmpPath };
    } catch {
      for (const p of [tmpPath, `${tmpPath}-wal`, `${tmpPath}-shm`]) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 120 * attempt));
      }
    }
  }
  throw new CookieImportError(
    `Cookie database is locked (${browserName} may be running). Try closing ${browserName} first.`,
    "db_locked",
    "retry",
  );
}

function closeDb(handle) {
  try {
    handle.db.close();
  } catch {}
  if (handle.copied && handle.tmpPath) {
    for (const p of [handle.tmpPath, `${handle.tmpPath}-wal`, `${handle.tmpPath}-shm`]) {
      try {
        fs.unlinkSync(p);
      } catch {}
    }
  }
}

export function deriveKey(password, iterations) {
  return crypto.pbkdf2Sync(password, "saltysalt", iterations, 16, "sha1");
}

function getCachedDerivedKey(cacheKey, password, iterations) {
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;
  const derived = deriveKey(password, iterations);
  keyCache.set(cacheKey, derived);
  return derived;
}

async function runCmd(cmd, args, timeoutMs) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      timeout: timeoutMs,
      windowsHide: true,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    return { ok: true, stdout: stdout || "", stderr: stderr || "" };
  } catch (err) {
    const stdout = typeof err?.stdout === "string" ? err.stdout : "";
    const stderr = typeof err?.stderr === "string" ? err.stderr : "";
    if (err?.killed || err?.signal === "SIGTERM" || err?.signal === "SIGKILL") {
      return { ok: false, timeout: true, stdout, stderr };
    }
    return { ok: false, stdout, stderr, code: err?.code, message: err?.message };
  }
}

async function runPowerShell(script, timeoutMs = 10000) {
  const commands = process.platform === "win32"
    ? ["powershell.exe", "powershell", "pwsh.exe", "pwsh"]
    : ["powershell", "pwsh"];
  let last = null;
  for (const cmd of commands) {
    const out = await runCmd(cmd, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], timeoutMs);
    if (out.ok) return out;
    last = out;
  }
  return last || { ok: false, message: "PowerShell unavailable" };
}

async function getMacKeychainPassword(service) {
  const out = await runCmd("security", ["find-generic-password", "-s", service, "-w"], 10000);
  if (out.timeout) {
    throw new CookieImportError(
      `macOS is waiting for Keychain permission. Allow access to '${service}'.`,
      "keychain_timeout",
      "retry",
    );
  }
  if (!out.ok) {
    const errText = `${out.stderr || out.message || ""}`.toLowerCase();
    if (
      errText.includes("user canceled") ||
      errText.includes("denied") ||
      errText.includes("interaction not allowed")
    ) {
      throw new CookieImportError(
        `Keychain access denied. Click Allow in macOS dialog for '${service}'.`,
        "keychain_denied",
        "retry",
      );
    }
    if (errText.includes("could not be found") || errText.includes("not found")) {
      throw new CookieImportError(`No Keychain entry for '${service}'.`, "keychain_not_found");
    }
    throw new CookieImportError(`Could not read Keychain: ${out.stderr || out.message}`, "keychain_error", "retry");
  }
  return out.stdout.trim();
}

async function getLinuxSecretPassword(browser) {
  const attempts = [["lookup", "Title", browser.keychainService]];
  if (browser.linuxApplication) {
    attempts.push(
      ["lookup", "xdg:schema", "chrome_libsecret_os_crypt_password_v2", "application", browser.linuxApplication],
      ["lookup", "xdg:schema", "chrome_libsecret_os_crypt_password", "application", browser.linuxApplication],
    );
  }
  for (const args of attempts) {
    const out = await runCmd("secret-tool", args, 3000);
    if (out.ok && out.stdout.trim().length > 0) return out.stdout.trim();
  }
  return null;
}

function getLocalStatePath(match) {
  const dataDir = getDataDirForPlatform(match.browser, match.platform);
  if (!dataDir) {
    throw new CookieImportError(`No data directory mapping for ${match.browser.name} on ${match.platform}`, "not_supported");
  }
  return path.join(getBaseDir(match.platform), dataDir, "Local State");
}

async function dpapiUnprotectBase64(base64Input) {
  const escaped = JSON.stringify(base64Input);
  const script = [
    `$inB64 = ${escaped}`,
    "$bytes = [Convert]::FromBase64String($inB64)",
    "$out = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Convert]::ToBase64String($out)",
  ].join("; ");
  const out = await runPowerShell(script, 12000);
  if (!out?.ok || !out.stdout || out.stdout.trim().length === 0) {
    throw new CookieImportError(
      `Could not decrypt Windows protected data: ${out?.stderr || out?.message || "unknown error"}`,
      "dpapi_error",
      "retry",
    );
  }
  return out.stdout.trim();
}

async function getWindowsMasterKey(match) {
  const localStatePath = getLocalStatePath(match);
  if (!fs.existsSync(localStatePath)) {
    throw new CookieImportError(`Missing Local State file: ${localStatePath}`, "not_installed");
  }

  let localState;
  try {
    localState = JSON.parse(fs.readFileSync(localStatePath, "utf8"));
  } catch {
    throw new CookieImportError(`Invalid Local State JSON: ${localStatePath}`, "bad_state");
  }

  const hasAppBoundKey =
    typeof localState?.os_crypt?.app_bound_encrypted_key === "string" &&
    localState.os_crypt.app_bound_encrypted_key.length > 0;
  const hasAppBoundFixedData = Object.keys(localState?.os_crypt || {}).some((key) =>
    key.startsWith("app_bound_fixed_data"),
  );
  if (hasAppBoundKey || hasAppBoundFixedData) {
    throw new CookieImportError(
      `${match.browser.name} uses App-Bound Encryption on this profile. Direct decrypt is not supported here; use cookie-import-browser ${match.browser.aliases?.[0] || match.browser.name.toLowerCase()} (picker mode).`,
      "abe_unsupported",
      "open_picker",
    );
  }

  const encryptedKeyB64 = localState?.os_crypt?.encrypted_key;
  if (!encryptedKeyB64 || typeof encryptedKeyB64 !== "string") {
    throw new CookieImportError("Missing os_crypt.encrypted_key in Local State", "key_missing");
  }

  const encryptedWithPrefix = Buffer.from(encryptedKeyB64, "base64");
  if (encryptedWithPrefix.length <= 5) {
    throw new CookieImportError("Invalid encrypted_key in Local State", "key_invalid");
  }
  const encrypted = encryptedWithPrefix.slice(0, 5).toString("utf8") === "DPAPI"
    ? encryptedWithPrefix.slice(5)
    : encryptedWithPrefix;
  const decryptedB64 = await dpapiUnprotectBase64(encrypted.toString("base64"));
  const masterKey = Buffer.from(decryptedB64, "base64");
  if (masterKey.length !== 32) {
    throw new CookieImportError(
      `Invalid Windows master key length: ${masterKey.length}`,
      "key_invalid",
    );
  }
  return masterKey;
}

async function getDerivedKeys(match) {
  if (match.platform === "win32") {
    const masterKey = await getWindowsMasterKey(match);
    return new Map([["win-master", masterKey]]);
  }
  if (match.platform === "darwin") {
    const password = await getMacKeychainPassword(match.browser.keychainService);
    return new Map([
      ["v10", getCachedDerivedKey(`darwin:${match.browser.keychainService}:v10`, password, 1003)],
    ]);
  }
  const keys = new Map();
  keys.set("v10", getCachedDerivedKey("linux:v10", "peanuts", 1));
  const linuxPassword = await getLinuxSecretPassword(match.browser);
  if (linuxPassword) {
    keys.set("v11", getCachedDerivedKey(`linux:${match.browser.keychainService}:v11`, linuxPassword, 1));
  }
  return keys;
}

function chromiumNow() {
  return BigInt(Date.now()) * 1000n + CHROMIUM_EPOCH_OFFSET;
}

export function chromiumEpochToUnix(epoch, hasExpires) {
  if (hasExpires === 0 || epoch === 0 || epoch === 0n) return -1;
  const epochBig = BigInt(epoch);
  const unixMicro = epochBig - CHROMIUM_EPOCH_OFFSET;
  return Number(unixMicro / 1000000n);
}

export function mapSameSite(value) {
  switch (value) {
    case 0:
      return "None";
    case 1:
      return "Lax";
    case 2:
      return "Strict";
    default:
      return "Lax";
  }
}

export async function decryptCookieValue(row, keys) {
  if (row.value && row.value.length > 0) return row.value;
  const ev = Buffer.isBuffer(row.encrypted_value)
    ? row.encrypted_value
    : Buffer.from(row.encrypted_value || []);
  if (ev.length === 0) return "";

  const winMaster = keys.get("win-master");
  if (winMaster) {
    const winPrefix = ev.slice(0, 3).toString("utf8");
    if ((winPrefix === "v10" || winPrefix === "v11" || winPrefix === "v20") && ev.length > 31) {
      const nonce = ev.slice(3, 15);
      const encrypted = ev.slice(15);
      const ciphertext = encrypted.slice(0, -16);
      const authTag = encrypted.slice(-16);
      let plaintext;
      try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", winMaster, nonce);
        decipher.setAuthTag(authTag);
        plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } catch {
        throw new CookieImportError("Could not decrypt cookie value (GCM auth failed)", "decrypt_failed");
      }

      const decoded = plaintext.toString("utf8");
      const replacementCount = [...decoded].filter((ch) => ch === "\uFFFD").length;
      const replacementRatio = decoded.length > 0 ? replacementCount / decoded.length : 0;
      const nonPrintableCount = [...decoded].filter((ch) => {
        const code = ch.charCodeAt(0);
        return code < 0x20 && code !== 0x09;
      }).length;
      const nonPrintableRatio = decoded.length > 0 ? nonPrintableCount / decoded.length : 0;
      if (replacementRatio > 0.02 || nonPrintableRatio > 0.02) {
        throw new CookieImportError("Decrypted cookie value is invalid", "decrypt_failed");
      }

      return decoded;
    }
    const decryptedB64 = await dpapiUnprotectBase64(ev.toString("base64"));
    return Buffer.from(decryptedB64, "base64").toString("utf8");
  }

  const prefix = ev.slice(0, 3).toString("utf8");
  const key = keys.get(prefix);
  if (!key) throw new CookieImportError(`No key for ${prefix}`, "decrypt_failed");

  const ciphertext = ev.slice(3);
  const iv = Buffer.alloc(16, 0x20);
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  if (plaintext.length <= 32) return "";
  return plaintext.slice(32).toString("utf8");
}

export function toPlaywrightCookie(row, value) {
  return {
    name: row.name,
    value,
    domain: row.host_key,
    path: row.path || "/",
    expires: chromiumEpochToUnix(row.expires_utc, row.has_expires),
    secure: row.is_secure === 1,
    httpOnly: row.is_httponly === 1,
    sameSite: mapSameSite(row.samesite),
  };
}

export function listSupportedBrowserNames() {
  const host = getHostPlatform();
  return BROWSER_REGISTRY.filter((b) => (host ? getDataDirForPlatform(b, host) !== null : true)).map(
    (b) => b.name,
  );
}

export function findInstalledBrowsers() {
  return BROWSER_REGISTRY.filter((browser) => {
    if (findBrowserMatch(browser, "Default") !== null) return true;
    for (const platform of getSearchPlatforms()) {
      const dataDir = getDataDirForPlatform(browser, platform);
      if (!dataDir) continue;
      const browserDir = path.join(getBaseDir(platform), dataDir);
      try {
        const entries = fs.readdirSync(browserDir, { withFileTypes: true });
        if (
          entries.some(
            (e) =>
              e.isDirectory() &&
              getCookieDbCandidatesFromProfileDir(path.join(browserDir, e.name)).some((candidate) =>
                fs.existsSync(candidate),
              ),
          )
        ) {
          return true;
        }
      } catch {}
    }
    return false;
  });
}

export function listProfiles(browserName) {
  const browser = resolveBrowser(browserName);
  const profiles = [];

  for (const platform of getSearchPlatforms()) {
    const dataDir = getDataDirForPlatform(browser, platform);
    if (!dataDir) continue;
    const browserDir = path.join(getBaseDir(platform), dataDir);
    if (!fs.existsSync(browserDir)) continue;

    let entries;
    try {
      entries = fs.readdirSync(browserDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;
      const hasCookieDb = getCookieDbCandidatesFromProfileDir(path.join(browserDir, entry.name)).some((candidate) =>
        fs.existsSync(candidate),
      );
      if (!hasCookieDb) continue;
      if (profiles.some((p) => p.name === entry.name)) continue;

      let displayName = entry.name;
      try {
        const prefsPath = path.join(browserDir, entry.name, "Preferences");
        if (fs.existsSync(prefsPath)) {
          const prefs = JSON.parse(fs.readFileSync(prefsPath, "utf8"));
          const email = prefs?.account_info?.[0]?.email;
          if (email && typeof email === "string") displayName = email;
          else if (typeof prefs?.profile?.name === "string") displayName = prefs.profile.name;
        }
      } catch {}
      profiles.push({ name: entry.name, displayName });
    }

    if (profiles.length > 0) break;
  }

  return profiles;
}

export async function listDomains(browserName, profile = "Default") {
  const browser = resolveBrowser(browserName);
  const match = getBrowserMatch(browser, profile);
  const handle = await openDb(match.dbPath, browser.name);
  try {
    const now = chromiumNow().toString();
    const rows = handle.db
      .prepare(
        `SELECT host_key AS domain, COUNT(*) AS count
         FROM cookies
         WHERE has_expires = 0 OR expires_utc > ?
         GROUP BY host_key
         ORDER BY count DESC`,
      )
      .all(now);
    return { domains: rows, browser: browser.name };
  } finally {
    closeDb(handle);
  }
}

export async function importCookies(browserName, domains, profile = "Default") {
  if (!Array.isArray(domains) || domains.length === 0) {
    return { cookies: [], count: 0, failed: 0, domainCounts: {} };
  }
  const domainCandidates = expandDomainCandidates(domains);
  if (domainCandidates.length === 0) {
    return { cookies: [], count: 0, failed: 0, domainCounts: {} };
  }
  const browser = resolveBrowser(browserName);
  const match = getBrowserMatch(browser, profile);
  const keys = await getDerivedKeys(match);
  const handle = await openDb(match.dbPath, browser.name);

  const requestedDomainSet = new Set(domains.map((domain) => normalizeDomainInput(domain)).filter(Boolean));

  try {
    const now = chromiumNow().toString();

    function readRowsForCandidates(candidates) {
      const placeholders = candidates.map(() => "?").join(",");
      return handle.db
        .prepare(
          `SELECT host_key, name, value, encrypted_value, path, expires_utc,
                  is_secure, is_httponly, has_expires, samesite
           FROM cookies
           WHERE host_key IN (${placeholders})
             AND (has_expires = 0 OR expires_utc > ?)
           ORDER BY host_key, name`,
        )
        .all(...candidates, now);
    }

    let rows = readRowsForCandidates(domainCandidates);
    let aliasNote = null;
    const requestedTwitter = requestedDomainSet.has("twitter.com") || requestedDomainSet.has(".twitter.com");
    if (rows.length === 0 && requestedTwitter) {
      const aliasCandidates = expandDomainCandidates(["x.com", ".x.com"]);
      rows = readRowsForCandidates(aliasCandidates);
      if (rows.length > 0) {
        aliasNote = "twitter.com cookies not found; used x.com alias";
      }
    }

    const cookies = [];
    let failed = 0;
    const domainCounts = {};
    for (const row of rows) {
      try {
        const value = await decryptCookieValue(row, keys);
        const cookie = toPlaywrightCookie(row, value);
        cookies.push(cookie);
        domainCounts[row.host_key] = (domainCounts[row.host_key] || 0) + 1;
      } catch (err) {
        if (err instanceof CookieImportError && err.code === "abe_unsupported") {
          throw err;
        }
        failed++;
      }
    }

    return { cookies, count: cookies.length, failed, domainCounts, aliasNote };
  } finally {
    closeDb(handle);
  }
}
