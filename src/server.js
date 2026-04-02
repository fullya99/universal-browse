#!/usr/bin/env node
import http from "node:http";
import crypto from "node:crypto";
import { BrowserManager } from "./browser-manager.js";
import { resolveConfig, writeState, clearState } from "./config.js";
import { getDisplayStrategy } from "./display-strategy.js";
import { handleCookiePickerRoute } from "./cookie-picker-routes.js";

const config = resolveConfig();
const strategy = getDisplayStrategy({ mode: config.mode });

if (strategy.error) {
  process.stderr.write(`${strategy.error}\n`);
  process.exit(1);
}

const token = crypto.randomUUID();
const manager = new BrowserManager(strategy);
let isShuttingDown = false;

function unauthorized(res) {
  res.writeHead(401, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Unauthorized" }));
}

function badRequest(res, msg) {
  res.writeHead(400, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: msg }));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw.length === 0 ? {} : JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function getAuthToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice("Bearer ".length);
}

async function start() {
  await manager.launch();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${config.host}`);

    if (url.pathname.startsWith("/cookie-picker")) {
      await handleCookiePickerRoute(req, res, url, manager, token);
      return;
    }

    if (url.pathname === "/health" && req.method === "GET") {
      const status = manager.getStatus();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          status: "healthy",
          mode: config.mode,
          strategy: strategy.mode,
          currentUrl: status.url,
          pageAvailable: status.pageAvailable,
          pageClosed: status.pageClosed,
          contextClosed: status.contextClosed,
          browserConnected: status.browserConnected,
        }),
      );
      return;
    }

    if (url.pathname === "/command" && req.method === "POST") {
      if (getAuthToken(req) !== token) return unauthorized(res);
      let body;
      try {
        body = await parseBody(req);
      } catch {
        return badRequest(res, "Invalid JSON");
      }

      const command = body.command;
      const args = Array.isArray(body.args) ? body.args : [];
      if (!command || typeof command !== "string") return badRequest(res, "Missing command");

      try {
        const output = await manager.exec(command, args);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, output }));
      } catch (err) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(0, config.host, () => {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    manager.setServerPort(port);
    writeState(config, {
      pid: process.pid,
      port,
      token,
      startedAt: new Date().toISOString(),
      mode: config.mode,
      strategy: strategy.mode,
    });
  });

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    server.close();
    try {
      await manager.close();
    } finally {
      clearState(config);
      process.exit(0);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("uncaughtException", async () => {
    await shutdown();
  });
  process.on("unhandledRejection", async () => {
    await shutdown();
  });
}

start().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
