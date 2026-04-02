# universal-browse

[![Node 20+](https://img.shields.io/badge/node-20%2B-2f7d32?style=flat-square)](https://nodejs.org)
[![Playwright 1.58+](https://img.shields.io/badge/playwright-1.58%2B-2e8b57?style=flat-square)](https://playwright.dev)
[![OS Support](https://img.shields.io/badge/support-linux%20%7C%20macOS%20%7C%20VPS-0f766e?style=flat-square)](#compatibility)
[![Headless + Headed](https://img.shields.io/badge/mode-headless%20%2B%20headed-1d4ed8?style=flat-square)](#how-it-works)
[![License MIT](https://img.shields.io/badge/license-MIT-111827?style=flat-square)](./LICENSE)

Universal, persistent browser runtime for AI coding workflows.

`universal-browse` gives you a fast local browser daemon and a thin CLI (`unibrowse`) that feels instant after startup. It is built for real engineering environments, not just local laptops:

- Linux dev machines
- Linux VPS and CI agents
- Linux servers with no display (auto Xvfb path for headed mode)
- macOS

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
- Linux/macOS display strategy detection (`headless-native`, `headed-native`, `headed-xvfb`)
- Full cookie importer:
  - `cookie-import <json-file>`
  - `cookie-import-browser <browser> --domain <domain> [--profile <profile>]`
  - interactive picker at `/cookie-picker`
- Decryption support for Chromium-style cookies (`v10` and Linux `v11` when secret service is available)

## Quickstart

```bash
npm install
npx playwright install --with-deps chromium
npm run preflight
```

Basic flow:

```bash
npx unibrowse goto https://example.com
npx unibrowse snapshot
npx unibrowse screenshot /tmp/example.png
```

Cookie flow:

```bash
npx unibrowse cookie-import /tmp/cookies.json
npx unibrowse cookie-import-browser chrome --domain .github.com --profile Default
npx unibrowse cookie-import-browser chrome
```

## How it works

`unibrowse` is a CLI client that ensures a background server is running, then sends commands over localhost.

1. CLI checks local state file (`.universal-browse/state.json`)
2. Starts daemon if missing/stale
3. Daemon launches Playwright Chromium with environment-aware strategy
4. Commands are executed in a persistent browser context

This gives stable behavior for long multi-step sessions where browser state matters.

## Compatibility

- **Linux desktop:** headed and headless
- **Linux VPS/CI:** headless default
- **Linux VPS headed:** auto uses `xvfb-run` when available
- **macOS:** headed and headless

Environment toggles:

- `UNIVERSAL_BROWSE_MODE=headless|headed`
- `UNIVERSAL_BROWSE_XVFB=0|1` (disable/enable Xvfb fallback)

## Cookie importer details

The browser importer reads Chromium profile cookie DBs and converts them into Playwright-compatible cookies.

- Supported families: Chrome, Chromium, Brave, Edge, Arc, Comet (when installed)
- Profile discovery: `Default` and `Profile N`
- Domain-scoped import for precise session transfer
- macOS keychain integration (`security`) and Linux secret service integration (`secret-tool`)
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

## Development

```bash
npm test
npm run preflight
```

## License

MIT. See `LICENSE`.
