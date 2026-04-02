import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  parseBody,
  sendJson,
  badRequest,
  unauthorized,
  getAuthToken,
} from "../src/http-helpers.js";

const TEST_TOKEN = "test-token-123";

function createTestServer(manager) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1`);

    if (url.pathname === "/health" && req.method === "GET") {
      const status = manager.getStatus();
      return sendJson(res, 200, { status: "healthy", ...status });
    }

    if (url.pathname === "/command" && req.method === "POST") {
      if (getAuthToken(req) !== TEST_TOKEN) return unauthorized(res);
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
      } catch {
        return sendJson(res, 500, { ok: false, error: "Command failed" });
      }
    }

    sendJson(res, 404, { error: "Not found" });
  });
}

function mockManager(execResult) {
  return {
    getStatus() {
      return { url: "https://example.com", pageAvailable: true };
    },
    async exec(_command, _args) {
      if (execResult instanceof Error) throw execResult;
      return execResult;
    },
  };
}

async function fetch(server, method, path, { headers = {}, body } = {}) {
  const addr = server.address();
  const url = `http://127.0.0.1:${addr.port}${path}`;
  const opts = { method, headers };
  if (body) opts.body = body;
  return globalThis.fetch(url, opts);
}

function withServer(manager, fn) {
  return new Promise((resolve, reject) => {
    const server = createTestServer(manager);
    server.listen(0, "127.0.0.1", async () => {
      try {
        await fn(server);
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

test("GET /health returns 200", async () => {
  await withServer(mockManager("ok"), async (server) => {
    const res = await fetch(server, "GET", "/health");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "healthy");
    assert.equal(body.pageAvailable, true);
  });
});

test("POST /command without auth returns 401", async () => {
  await withServer(mockManager("ok"), async (server) => {
    const res = await fetch(server, "POST", "/command", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "status" }),
    });
    assert.equal(res.status, 401);
  });
});

test("POST /command with invalid JSON returns 400", async () => {
  await withServer(mockManager("ok"), async (server) => {
    const res = await fetch(server, "POST", "/command", {
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: "{bad json",
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Invalid JSON");
  });
});

test("POST /command with missing command returns 400", async () => {
  await withServer(mockManager("ok"), async (server) => {
    const res = await fetch(server, "POST", "/command", {
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Missing command");
  });
});

test("POST /command with valid command returns 200", async () => {
  await withServer(mockManager("result-data"), async (server) => {
    const res = await fetch(server, "POST", "/command", {
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({ command: "status" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.output, "result-data");
  });
});

test("POST /command exec error returns 500 with generic message", async () => {
  await withServer(mockManager(new Error("secret internal error")), async (server) => {
    const res = await fetch(server, "POST", "/command", {
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({ command: "fail" }),
    });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.error, "Command failed");
    assert.ok(!body.error.includes("secret"));
  });
});

test("GET /unknown returns 404", async () => {
  await withServer(mockManager("ok"), async (server) => {
    const res = await fetch(server, "GET", "/nonexistent");
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, "Not found");
  });
});
