import {
  CookieImportError,
  findInstalledBrowsers,
  importCookies,
  listDomains,
  listProfiles,
} from "./cookie-import-browser.js";
import { getCookiePickerHTML } from "./cookie-picker-ui.js";
import {
  parseBody as parseBodyBase,
  unauthorized as unauthorizedBase,
  getAuthToken,
} from "./http-helpers.js";

const importedDomains = new Set();
const importedCounts = new Map();

let lastImportTimestamp = 0;

function logPickerError(pathname, err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[cookie-picker] ${pathname}: ${message}\n`);
}

function sendJson(res, status, payload, port) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": `http://127.0.0.1:${port}`,
  });
  res.end(JSON.stringify(payload));
}

function unauthorized(res) {
  unauthorizedBase(res);
}

async function parseBody(req) {
  return parseBodyBase(req);
}

function checkAuth(req, token) {
  if (!token) return true;
  return getAuthToken(req) === token;
}

export async function handleCookiePickerRoute(req, res, url, browserManager, authToken) {
  const pathname = url.pathname;
  const port = Number(url.port || 0) || 9400;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": `http://127.0.0.1:${port}`,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    });
    res.end();
    return;
  }

  try {
    if (pathname === "/cookie-picker" && req.method === "GET") {
      const html = getCookiePickerHTML(port, authToken);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (!checkAuth(req, authToken)) return unauthorized(res);

    if (pathname === "/cookie-picker/browsers" && req.method === "GET") {
      const browsers = findInstalledBrowsers().map((b) => ({ name: b.name, aliases: b.aliases }));
      return sendJson(res, 200, { browsers }, port);
    }

    if (pathname === "/cookie-picker/profiles" && req.method === "GET") {
      const browserName = url.searchParams.get("browser");
      if (!browserName) return sendJson(res, 400, { error: "Missing browser" }, port);
      const profiles = listProfiles(browserName);
      return sendJson(res, 200, { profiles }, port);
    }

    if (pathname === "/cookie-picker/domains" && req.method === "GET") {
      const browserName = url.searchParams.get("browser");
      const profile = url.searchParams.get("profile") || "Default";
      if (!browserName) return sendJson(res, 400, { error: "Missing browser" }, port);
      const result = await listDomains(browserName, profile);
      return sendJson(res, 200, result, port);
    }

    if (pathname === "/cookie-picker/debug" && req.method === "GET") {
      const browserName = url.searchParams.get("browser") || null;
      const profile = url.searchParams.get("profile") || "Default";
      const debug = {
        browserName,
        profile,
        browsers: [],
        profiles: null,
        domains: null,
        errors: [],
      };
      try {
        debug.browsers = findInstalledBrowsers().map((b) => ({ name: b.name, aliases: b.aliases }));
      } catch (err) {
        debug.errors.push({ scope: "browsers", message: err instanceof Error ? err.message : String(err) });
      }
      if (browserName) {
        try {
          debug.profiles = listProfiles(browserName);
        } catch (err) {
          debug.errors.push({ scope: "profiles", message: err instanceof Error ? err.message : String(err) });
        }
        try {
          debug.domains = await listDomains(browserName, profile);
        } catch (err) {
          debug.errors.push({ scope: "domains", message: err instanceof Error ? err.message : String(err) });
        }
      }
      return sendJson(res, 200, debug, port);
    }

    if (pathname === "/cookie-picker/import" && req.method === "POST") {
      const now = Date.now();
      if (now - lastImportTimestamp < 2000) {
        return sendJson(res, 429, { error: "Too many requests. Wait before retrying." }, port);
      }
      lastImportTimestamp = now;

      const body = await parseBody(req);
      const browser = body.browser;
      const profile = body.profile || "Default";
      const domains = Array.isArray(body.domains) ? body.domains : [];
      if (!browser) return sendJson(res, 400, { error: "Missing browser" }, port);
      if (domains.length === 0) return sendJson(res, 400, { error: "Missing domains" }, port);

      const result = await importCookies(browser, domains, profile);
      if (result.cookies.length > 0) {
        await browserManager.getPage().context().addCookies(result.cookies);
      }
      for (const domain of Object.keys(result.domainCounts)) {
        importedDomains.add(domain);
        importedCounts.set(domain, (importedCounts.get(domain) || 0) + result.domainCounts[domain]);
      }
      return sendJson(
        res,
        200,
        { imported: result.count, failed: result.failed, domainCounts: result.domainCounts },
        port,
      );
    }

    if (pathname === "/cookie-picker/remove" && req.method === "POST") {
      const body = await parseBody(req);
      const domains = Array.isArray(body.domains) ? body.domains : [];
      if (domains.length === 0) return sendJson(res, 400, { error: "Missing domains" }, port);

      const context = browserManager.getPage().context();
      for (const domain of domains) {
        await context.clearCookies({ domain });
        importedDomains.delete(domain);
        importedCounts.delete(domain);
      }
      return sendJson(res, 200, { removed: domains.length, domains }, port);
    }

    if (pathname === "/cookie-picker/imported" && req.method === "GET") {
      const domains = [...importedDomains].map((domain) => ({ domain, count: importedCounts.get(domain) || 0 }));
      domains.sort((a, b) => b.count - a.count);
      return sendJson(
        res,
        200,
        {
          domains,
          totalDomains: domains.length,
          totalCookies: domains.reduce((s, d) => s + d.count, 0),
        },
        port,
      );
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    if (err instanceof CookieImportError) {
      logPickerError(pathname, err);
      return sendJson(res, 400, { error: err.message, code: err.code, action: err.action }, port);
    }
    logPickerError(pathname, err);
    return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) }, port);
  }
}
