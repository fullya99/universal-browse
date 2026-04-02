# universal-browse

[![Node 20+](https://img.shields.io/badge/node-20%2B-2f7d32?style=flat-square)](https://nodejs.org)
[![Playwright 1.58+](https://img.shields.io/badge/playwright-1.58%2B-2e8b57?style=flat-square)](https://playwright.dev)
[![CI](https://github.com/fullya99/universal-browse/actions/workflows/ci.yml/badge.svg)](https://github.com/fullya99/universal-browse/actions/workflows/ci.yml)
[![OS Support](https://img.shields.io/badge/support-linux%20%7C%20macOS%20%7C%20windows%20%7C%20VPS-0f766e?style=flat-square)](#compatibility)
[![Headless + Headed](https://img.shields.io/badge/mode-headless%20%2B%20headed-1d4ed8?style=flat-square)](#how-it-works)
[![License MIT](https://img.shields.io/badge/license-MIT-111827?style=flat-square)](./LICENSE)

Universal, persistent browser runtime for AI coding workflows.

`universal-browse` gives you a fast local browser daemon and a thin CLI (`unibrowse`) that feels instant after startup. It is built for real engineering environments, not just local laptops:

- Linux dev machines
- Linux VPS and CI agents
- Linux servers with no display (auto Xvfb path for headed mode)
- macOS
- Windows

It includes practical session transfer paths for real-world use (JSON cookie import + native browser profile launch), ported for long-term Node compatibility.

## Why this project exists

Most browser automation tools are either:

- great in tests but awkward in agent loops, or
- fast in one environment but brittle across VPS/macOS/Linux display setups.

`universal-browse` is designed as an operational layer for autonomous and semi-autonomous workflows:

- persistent session state
- small command surface for agents
- local-only control plane with bearer auth
- explicit handling of Linux display realities
- practical browser-cookie bridge for authenticated testing and debugging

## Core capabilities

- Persistent daemon with token-protected command endpoint on `127.0.0.1`
- Fast CLI command model (`goto`, `snapshot`, `fill`, `click`, `screenshot`, etc.)
- Linux/macOS/Windows display strategy detection (`headless-native`, `headed-native`, `headed-xvfb`)
- Full cookie importer:
  - `cookie-import <json-file>`
  - `launch-with-profile <chrome|brave|edge> [--profile <name>]`
- Decryption support for Chromium-style cookies (macOS `v10`, Linux `v10`/`v11`, Windows DPAPI + AES-GCM with explicit App-Bound Encryption detection)

## Quickstart

```bash
npm ci
npx playwright install --with-deps chromium
npm run preflight
```

On Windows, also run:

```powershell
npm run setup:windows
```

On macOS, optional bootstrap:

```bash
npm run setup:macos
```

On Linux, optional bootstrap:

```bash
npm run setup:linux
```

Basic flow:

```bash
npm run unibrowse -- goto https://example.com
npm run unibrowse -- snapshot
npm run unibrowse -- screenshot
```

Cookie flow:

```bash
npm run unibrowse -- cookie-import /tmp/cookies.json
npm run unibrowse -- launch-with-profile brave --profile Default
```

## AI-assisted installation protocol

If your users run AI agents in terminal tools (Claude Code, Codex CLI, OpenCode, Gemini CLI wrappers, etc.), give them a single prompt that installs, validates, and smoke-tests `universal-browse` in one run.

For a complete adapter playbook (CLI + IDE), see `skill/universal-browse/references/ai-cli-integration.md`.

### Copy-paste prompt (universal)

```text
You are in the root of the universal-browse repository.

Use this helper as the source of truth:
- skill/universal-browse/references/ai-cli-integration.md

First, run section "3) Universal bootstrap prompt (for any AI CLI)".
Important: make the process interactive by asking the user choices before setup (tool, scope, native install mode, fallback behavior) as defined in section "3".

Then run section "5) Install and validate runtime", and finish with sections "7" and "8".

Important:
- Do not report full success unless both statuses pass:
  - `READY-RUNTIME`
  - `READY-NATIVE-SKILL`

Constraints:
- do not commit or push
- do not modify source files
- stop on destructive actions
- show each command before running it

Output format:
- PASS or FAIL
- OS + Node + npm versions
- command-by-command status
- exact failing output if any
- next actions if failed
- selected user choices (tool/scope/native mode)
- final status split:
  - READY-RUNTIME
  - READY-NATIVE-SKILL (or READY-RUNTIME-ONLY)
```

### Tool-specific note

- For local repo usage, prefer `npm run unibrowse -- <command>`.
- `npx unibrowse` also works after install in most environments, but `npm run` is the most deterministic path for agent workflows.
- Keep the same guardrails across all AI CLIs: no token leakage, no raw cookie leakage, no auto-commit/push during setup.

### Where to plug instructions by tool

- Claude Code: standalone native skill in `.claude/skills/universal-browse/SKILL.md` via installer scripts; `CLAUDE.md` is supporting memory
- Codex CLI: `AGENTS.md` / `AGENTS.override.md` (native discovery)
- OpenCode: `AGENTS.md` (native, via `/init`)
- Cursor/Windsurf/other IDE agents: workspace rules/instructions file
- Gemini CLI: `GEMINI.md` (native project context file)
- Kimi Code CLI: `AGENTS.md` (native, generated via `/init`)
- Gemini/Kimi wrappers without native convention: fallback `AI_INSTRUCTIONS.md` but classify as runtime-only until native proof exists

If your tool does not have a dedicated instruction file, keep a project-level `AI_INSTRUCTIONS.md`, but report status as `READY-RUNTIME-ONLY` until native registration is available.

### Claude Code native install (recommended)

Install the skill file directly in Claude native scope:

```bash
# project-native
npm run install:claude:project

# personal-native
npm run install:claude:personal
```

This path is deterministic and does not require marketplace setup.

### Claude Code install policy

Plugin-based install is no longer part of the supported integration path for this repository.
Use standalone native skill install only:

```bash
npm run install:claude:project
# or
npm run install:claude:personal
```

## How it works

`unibrowse` is a CLI client that ensures a background server is running, then sends commands over localhost.

1. CLI checks local state file (`.universal-browse/state.json`)
2. Starts daemon if missing/stale
3. Daemon launches Playwright Chromium with environment-aware strategy
4. Commands are executed in a persistent browser context

This gives stable behavior for long multi-step sessions where browser state matters.

## Architecture diagram

```text
┌──────────────────────────┐
│ Agent / Developer / CI   │
└─────────────┬────────────┘
              │ unibrowse <command>
┌─────────────▼────────────┐
│ CLI Client (src/cli.js)  │
│ - reads local state      │
│ - starts daemon if needed│
└─────────────┬────────────┘
              │ localhost + bearer token
┌─────────────▼────────────────────────────────────┐
│ Local Daemon (src/server.js)                     │
│ - /health, /command                              │
│ - /cookie-picker*                                │
└─────────────┬────────────────────────────────────┘
              │
┌─────────────▼────────────────────────────────────┐
│ Browser Manager (src/browser-manager.js)         │
│ - persistent Playwright context                  │
│ - command execution + logs                        │
│ - cookie import hooks                             │
└─────────────┬────────────────────────────────────┘
              │
      ┌───────▼────────┐      ┌─────────────────────────┐
      │ Playwright     │      │ Cookie Import Engine    │
      │ Chromium       │◄────►│ - SQLite profile reads  │
      │ session        │      │ - v10/v11 decryption    │
      └────────────────┘      └─────────────────────────┘
```

## Compatibility

- **Linux desktop:** headed and headless
- **Linux VPS/CI:** headless default
- **Linux VPS headed:** auto uses `xvfb-run` when available
- **macOS:** headed and headless
- **Windows:** headed and headless

Environment toggles:

- `UNIVERSAL_BROWSE_MODE=headless|headed`
- `UNIVERSAL_BROWSE_XVFB=0|1` (disable/enable Xvfb fallback)

## Session transfer details

- `cookie-import <json-file>` loads Playwright-style cookies from local JSON.
- `launch-with-profile <chrome|brave|edge> --profile <name>` runs against a real installed browser profile.
- For Windows reliability, native profile mode is preferred over direct browser-cookie decryption.

## Security model

- Daemon binds to localhost only
- Command endpoint requires bearer token
- Path checks on local JSON cookie import
- `cookies` command output masks cookie values by default
- Treat JSON cookie exports as secrets (delete after use)
- Optional strict mode: set `UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK=1` to require `--allow-plaintext-cookies` on `cookie-import`
- No remote control channel exposed by default

## Command reference

```text
status
stop
goto <url>
text
snapshot
click <selector>
fill <selector> <value>
wait <ms>
scroll <up|down> <pixels>
eval <js expression>
viewport <w>x<h>
screenshot [path]
console
network
cookies
cookie-import <json-file>
cookie-import <json-file> --allow-plaintext-cookies
launch-with-profile <chrome|brave|edge> [--profile name]
```

Google account note:

- Even with valid exported cookies, Google services (Gmail/Drive/Docs/GAIA) may reject imported sessions in a fresh Playwright context due to device/session binding controls.
- In those cases, `cookie-import` is not a reliable auth transfer mechanism for Google properties.

Challenge handling note:

- `goto` detects common Cloudflare/anti-bot challenge states.
- If a challenge is detected while running headless, runtime attempts to switch to headed automatically.
- Runtime captures a challenge screenshot and attempts common interaction clicks before returning status.

Native profile launch note:

- `launch-with-profile` reuses your installed browser profile directory (`User Data`) and launches Playwright against that real profile.
- Risks and constraints:
  - close the source browser first to avoid profile lock conflicts,
  - treat this mode as highly sensitive (live sessions/cookies/local browser state are accessible to automation),
  - browser support is currently `chrome`, `brave`, and `edge`.

## Skill package

Claude-compatible skill files are included in:

- `skill/universal-browse/SKILL.md`
- `skill/universal-browse/references/`

### Prompt to plug into any AI CLI

Use this when a user wants their AI CLI to bootstrap and register a reusable `unibrowse` workflow in that tool's local config/project notes.

```text
You are my CLI automation assistant. Configure this repository so I can use universal-browse quickly from this tool.

Repository: universal-browse
Main command: npm run unibrowse -- <command>

Tasks:
1) Verify repo is up to date (git pull origin main).
2) Install and validate (npm ci, playwright install, npm run preflight, npm test).
3) Run smoke commands (status, goto, snapshot, screenshot, stop).
4) Create or update this tool's local project instructions so future sessions know:
   - use `npm run unibrowse -- <command>` for browser actions
   - run `npm run preflight` before troubleshooting
   - never expose daemon tokens in logs
5) Print a final summary with:
   - what was configured
   - where config/instructions were written
   - commands the user can run next

Constraints:
- no git commit or push
- no destructive git commands
- keep changes local to this project only
```

## Development

```bash
npm test
npm run preflight
```

For local repo usage (without global install), run the CLI via:

```bash
npm run unibrowse -- status
npm run unibrowse -- goto https://example.com
```

## License

MIT. See `LICENSE`.
