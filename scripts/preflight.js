#!/usr/bin/env node
import os from "node:os";
import { spawnSync } from "node:child_process";

function check(label, ok, info = "") {
  const mark = ok ? "PASS" : "FAIL";
  process.stdout.write(`${mark} ${label}${info ? ` - ${info}` : ""}\n`);
  return ok;
}

function checkOptional(label, ok, info = "") {
  const mark = ok ? "PASS" : "WARN";
  process.stdout.write(`${mark} ${label}${info ? ` - ${info}` : ""}\n`);
  return ok;
}

function hasProgram(name) {
  const lookupCmd = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(lookupCmd, [name], {
    stdio: ["ignore", "ignore", "ignore"],
    timeout: 1000,
  });
  return r.status === 0;
}

function hasAnyProgram(names) {
  return names.some((name) => hasProgram(name));
}

function nodeMajor() {
  const m = process.versions.node.match(/^(\d+)/);
  return m ? Number(m[1]) : 0;
}

const platform = process.platform;
const release = os.release();
process.stdout.write(`Platform: ${platform} ${release}\n`);

let okAll = true;
okAll = check("Node >= 20", nodeMajor() >= 20, process.versions.node) && okAll;
okAll = check("npm available", hasProgram("npm")) && okAll;
okAll = check("playwright available", hasProgram("npx")) && okAll;

if (platform === "linux") {
  checkOptional("xvfb-run available (optional)", hasProgram("xvfb-run"), "needed for headed mode without display");
  checkOptional("secret-tool available (optional)", hasProgram("secret-tool"), "needed for Linux v11 cookie decryption");
}

if (platform === "darwin") {
  checkOptional("security CLI available", hasProgram("security"), "needed for macOS keychain cookie decryption");
}

if (platform === "win32") {
  checkOptional(
    "PowerShell available",
    hasAnyProgram(["powershell", "powershell.exe", "pwsh", "pwsh.exe"]),
    "needed for Windows DPAPI cookie decryption",
  );
}

if (!okAll) {
  process.exit(1);
}
