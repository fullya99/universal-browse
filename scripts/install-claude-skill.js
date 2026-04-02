#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const SKILL_NAME = "universal-browse";

const USAGE = `Usage: node scripts/install-claude-skill.js --scope <project|personal> [--force]\n\n` +
  `Examples:\n` +
  `  node scripts/install-claude-skill.js --scope project\n` +
  `  node scripts/install-claude-skill.js --scope personal --force`;

function parseArgs(argv) {
  let scope = null;
  let force = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--scope") { scope = argv[i + 1] || null; i += 1; continue; }
    if (arg === "--force") { force = true; continue; }
    if (arg === "--help" || arg === "-h") { return { help: true, scope: null, force: false }; }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { help: false, scope, force };
}

function getTargetDir(scope) {
  const base = scope === "project"
    ? path.resolve(process.cwd(), ".claude", "skills")
    : path.resolve(os.homedir(), ".claude", "skills");
  return path.join(base, SKILL_NAME);
}

async function main() {
  try {
    const { help, scope, force } = parseArgs(process.argv.slice(2));
    if (help) { console.log(USAGE); return; }
    if (!scope) throw new Error("Missing required --scope argument.");

    const sourceDir = path.resolve(process.cwd(), "skill", SKILL_NAME);
    const targetDir = getTargetDir(scope);

    // Validate source exists and contains SKILL.md
    await fs.access(path.join(sourceDir, "SKILL.md"));

    // Check target if not force
    if (!force) {
      try {
        await fs.access(targetDir);
        throw new Error(`Target already exists: ${targetDir}. Use --force to overwrite.`);
      } catch (error) {
        if (error && error.code !== "ENOENT") throw error;
      }
    }

    // Remove existing target if force (clean install)
    if (force) {
      await fs.rm(targetDir, { recursive: true, force: true });
    }

    // Recursive copy of entire skill directory (SKILL.md + references/)
    // fs.cp is stable in Node 20+ — no external dependency needed
    await fs.cp(sourceDir, targetDir, { recursive: true });

    console.log(`[${SKILL_NAME}] Installed skill directory to: ${targetDir}`);
    console.log(`[${SKILL_NAME}] Contents copied:`);

    // List what was installed for verification
    const entries = [];
    async function walk(dir, prefix = "") {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) { await walk(path.join(dir, entry.name), rel); }
        else { entries.push(rel); }
      }
    }
    await walk(targetDir);
    for (const e of entries) console.log(`  - ${e}`);

    console.log(`[${SKILL_NAME}] Scope: ${scope}`);
    console.log(`[${SKILL_NAME}] Run \`npm run preflight\` to verify runtime readiness.`);
  } catch (error) {
    console.error(`[${SKILL_NAME}] Skill install failed: ${error.message}`);
    console.error(USAGE);
    process.exit(1);
  }
}

main();
