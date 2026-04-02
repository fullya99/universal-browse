import test from "node:test";
import assert from "node:assert/strict";
import { listSupportedBrowserNames } from "../src/cookie-import-browser.js";

test("supported browser list is non-empty", () => {
  const names = listSupportedBrowserNames();
  assert.ok(Array.isArray(names));
  assert.ok(names.length > 0);
});
