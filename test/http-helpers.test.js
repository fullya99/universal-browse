import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  parseBody,
  sendJson,
  badRequest,
  unauthorized,
  getAuthToken,
} from "../src/http-helpers.js";

function makeReq(body) {
  return Readable.from(body ? [Buffer.from(body)] : []);
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

test("parseBody parses valid JSON", async () => {
  const result = await parseBody(makeReq('{"key":"value"}'));
  assert.deepEqual(result, { key: "value" });
});

test("parseBody returns empty object for empty body", async () => {
  const result = await parseBody(makeReq(""));
  assert.deepEqual(result, {});
});

test("parseBody throws on malformed JSON", async () => {
  await assert.rejects(
    parseBody(makeReq("{bad json")),
    { name: "SyntaxError" },
  );
});

test("parseBody throws on oversized body", async () => {
  const big = Buffer.alloc(1024 * 1024 + 1, "x");
  await assert.rejects(
    parseBody(Readable.from([big])),
    /Request body too large/,
  );
});

test("getAuthToken extracts valid bearer token", () => {
  assert.equal(getAuthToken({ headers: { authorization: "Bearer abc123" } }), "abc123");
});

test("getAuthToken returns empty for missing auth header", () => {
  assert.equal(getAuthToken({ headers: {} }), "");
});

test("getAuthToken returns empty for non-bearer auth", () => {
  assert.equal(getAuthToken({ headers: { authorization: "Basic abc123" } }), "");
});

test("sendJson writes JSON response", () => {
  const res = makeRes();
  sendJson(res, 200, { ok: true });
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true });
  assert.equal(res.headers["content-type"], "application/json");
});

test("badRequest sends 400 response", () => {
  const res = makeRes();
  badRequest(res, "Invalid input");
  assert.equal(res.status, 400);
  assert.deepEqual(JSON.parse(res.body), { error: "Invalid input" });
});

test("unauthorized sends 401 response", () => {
  const res = makeRes();
  unauthorized(res);
  assert.equal(res.status, 401);
  assert.deepEqual(JSON.parse(res.body), { error: "Unauthorized" });
});
