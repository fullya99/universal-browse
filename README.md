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

It also includes a complete Chromium cookie importer suite (JSON import, browser-profile import, and interactive picker UI), ported for long-term Node compatibility.

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
  - `cookie-import-browser <browser> --domain <domain> [--profile <profile>]`
  - interactive picker at `/cookie-picker`
- Decryption support for Chromium-style cookies (macOS `v10`, Linux `v10`/`v11`, Windows DPAPI + AES-GCM)

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
npm run unibrowse -- cookie-import-browser chrome --domain .github.com --profile Default
npm run unibrowse -- cookie-import-browser chrome
```

## AI-assisted installation protocol

If your users run AI agents in terminal tools (Claude Code, Codex CLI, OpenCode, Gemini CLI wrappers, etc.), give them a single prompt that installs, validates, and smoke-tests `universal-browse` in one run.

For a complete adapter playbook (CLI + IDE), see `skill/universal-browse/references/ai-cli-integration.md`.

### Copy-paste prompt (universal)

```text
You are in the root of the universal-browse repository.

Goal:
- install dependencies
- run OS-appropriate setup
- validate runtime
- print a short PASS/FAIL report with evidence

Rules:
- do not commit or push
- do not modify source files
- stop on destructive actions
- show each command before running it

Steps:
1) Sync and environment
   - git pull origin main
   - node -v
   - npm -v

2) Install
   - npm ci
   - if OS is Linux: npx playwright install --with-deps chromium
   - if OS is macOS/Windows: npx playwright install chromium
   - if OS is Linux: npm run setup:linux (continue on non-fatal package manager errors)
   - if OS is macOS: npm run setup:macos
   - if OS is Windows: npm run setup:windows

3) Validate
   - npm run preflight
   - npm test

4) Smoke test CLI
   - npm run unibrowse -- stop
   - npm run unibrowse -- status
   - npm run unibrowse -- goto https://example.com
   - npm run unibrowse -- snapshot
   - npm run unibrowse -- screenshot
   - npm run unibrowse -- stop

5) Print final report
   - overall result: PASS or FAIL
   - OS, Node version, npm version
   - each step with command + status
   - exact failing output if any
   - next action list if failed
```

### Tool-specific note

- For local repo usage, prefer `npm run unibrowse -- <command>`.
- `npx unibrowse` also works after install in most environments, but `npm run` is the most deterministic path for agent workflows.

### Where to plug instructions by tool

- Claude Code: project `CLAUDE.md` (or session instructions if no project file)
- Codex CLI: project `AGENTS.md` or local agent instruction file used by your Codex setup
- OpenCode: project instruction file configured for the current workspace
- Cursor/Windsurf/other IDE agents: workspace rules/instructions file
- Gemini CLI wrappers: project prompt/instruction file loaded at session start

If your tool does not have a dedicated instruction file, keep a project-level `AI_INSTRUCTIONS.md` and paste the integration prompt there.

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

## Cookie importer details

The browser importer reads Chromium profile cookie DBs and converts them into Playwright-compatible cookies.

- Supported families: Chrome, Chromium, Brave, Edge, Arc, Comet (when installed)
- Profile discovery: `Default` and `Profile N`
- Domain-scoped import for precise session transfer
- macOS keychain integration (`security`) and Linux secret service integration (`secret-tool`)
- Windows DPAPI + Chromium `Local State` master-key decryption
- Safe fallback for locked DBs by reading from temporary copied SQLite DB files

## Security model

- Daemon binds to localhost only
- Command endpoint requires bearer token
- Cookie picker data/action routes are token-protected
- Path checks on local JSON cookie import
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
viewport <w>x<h>
screenshot [path]
console
network
cookies
cookie-import <json-file>
cookie-import-browser [browser] [--domain d] [--profile p]
```

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
