#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const USAGE = `Usage: node scripts/install-claude-skill.js --scope <project|personal> [--force]\n\n` +
  `Examples:\n` +
  `  node scripts/install-claude-skill.js --scope project\n` +
  `  node scripts/install-claude-skill.js --scope personal --force`;

function parseArgs(argv) {
  let scope = null;
  let force = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--scope") {
      scope = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return { help: true, scope: null, force: false };
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help: false, scope, force };
}

function getTargetPath(scope) {
  if (scope === "project") {
    return path.resolve(process.cwd(), ".claude", "skills", "universal-browse", "SKILL.md");
  }
  if (scope === "personal") {
    return path.resolve(os.homedir(), ".claude", "skills", "universal-browse", "SKILL.md");
  }
  throw new Error(`Invalid scope: ${scope}. Expected project or personal.`);
}

async function main() {
  try {
    const { help, scope, force } = parseArgs(process.argv.slice(2));
    if (help) {
      console.log(USAGE);
      return;
    }

    if (!scope) {
      throw new Error("Missing required --scope argument.");
    }

    const sourcePath = path.resolve(process.cwd(), "skill", "universal-browse", "SKILL.md");
    const targetPath = getTargetPath(scope);
    const targetDir = path.dirname(targetPath);

    await fs.access(sourcePath);

    if (!force) {
      try {
        await fs.access(targetPath);
        throw new Error(`Target already exists: ${targetPath}. Use --force to overwrite.`);
      } catch (error) {
        if (error && error.code !== "ENOENT") {
          throw error;
        }
      }
    }

    await fs.mkdir(targetDir, { recursive: true });
    await fs.copyFile(sourcePath, targetPath);

    console.log(`[universal-browse] Installed Claude skill to: ${targetPath}`);
    console.log(`[universal-browse] Scope: ${scope}`);
    console.log("[universal-browse] Run `npm run preflight` to verify runtime readiness.");
  } catch (error) {
    console.error(`[universal-browse] Claude skill install failed: ${error.message}`);
    console.error(USAGE);
    process.exit(1);
  }
}

main();
