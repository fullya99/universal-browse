#!/usr/bin/env node
import http from "node:http";
import crypto from "node:crypto";
import { BrowserManager } from "./browser-manager.js";
import { resolveConfig, writeState, clearState } from "./config.js";
import { getDisplayStrategy } from "./display-strategy.js";
import { handleCookiePickerRoute } from "./cookie-picker-routes.js";
import {
  parseBody,
  sendJson,
  badRequest,
  unauthorized,
  getAuthToken,
} from "./http-helpers.js";

const config = resolveConfig();
const strategy = getDisplayStrategy({ mode: config.mode });

if (strategy.error) {
  process.stderr.write(`${strategy.error}\n`);
  process.exit(1);
}

const token = crypto.randomUUID();
const manager = new BrowserManager(strategy);
let isShuttingDown = false;

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
      return sendJson(res, 200, {
        status: "healthy",
        mode: config.mode,
        strategy: strategy.mode,
        currentUrl: status.url,
        pageAvailable: status.pageAvailable,
        pageClosed: status.pageClosed,
        contextClosed: status.contextClosed,
        browserConnected: status.browserConnected,
      });
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
        return sendJson(res, 200, { ok: true, output });
      } catch (err) {
        console.error("Command error:", err);
        return sendJson(res, 500, { ok: false, error: "Command failed" });
      }
    }

    sendJson(res, 404, { error: "Not found" });
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

  process.on("SIGTERM", () => {
    shutdown().catch((err) => {
      console.error("Shutdown error (SIGTERM):", err);
    });
  });
  process.on("SIGINT", () => {
    shutdown().catch((err) => {
      console.error("Shutdown error (SIGINT):", err);
    });
  });
  process.on("uncaughtException", async (err) => {
    console.error("Uncaught exception:", err);
    await shutdown().catch((shutdownErr) => {
      console.error("Shutdown error after uncaughtException:", shutdownErr);
    });
  });
  process.on("unhandledRejection", async (reason) => {
    console.error("Unhandled rejection:", reason);
    await shutdown().catch((shutdownErr) => {
      console.error("Shutdown error after unhandledRejection:", shutdownErr);
    });
  });
}

start().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
