# universal-browse

[![Node 20+](https://img.shields.io/badge/node-20%2B-2f7d32?style=flat-square)](https://nodejs.org)
[![Playwright 1.58+](https://img.shields.io/badge/playwright-1.58%2B-2e8b57?style=flat-square)](https://playwright.dev)
[![CI](https://github.com/fullya99/universal-browse/actions/workflows/ci.yml/badge.svg)](https://github.com/fullya99/universal-browse/actions/workflows/ci.yml)
[![OS Support](https://img.shields.io/badge/support-linux%20%7C%20macOS%20%7C%20windows%20%7C%20VPS-0f766e?style=flat-square)](#compatibility)
[![Headless + Headed](https://img.shields.io/badge/mode-headless%20%2B%20headed-1d4ed8?style=flat-square)](#how-it-works)
[![License MIT](https://img.shields.io/badge/license-MIT-111827?style=flat-square)](./LICENSE)

Persistent browser daemon and CLI for AI-assisted QA, dogfooding, and web automation.

One `npm ci` and you get a local Playwright daemon (`unibrowse`) that stays alive across commands, works on Linux/macOS/Windows/VPS, and handles cookie import and browser profile reuse out of the box.

## Install

```bash
git clone https://github.com/fullya99/universal-browse.git
cd universal-browse
npm run setup      # installs deps + Playwright Chromium + runs preflight (all platforms)
```

That's it. One command. `npm run setup` handles `npm install`, Chromium browser download (with system deps on Linux), and verifies everything is ready.

Alternatively, step by step:

```bash
npm ci
npx playwright install --with-deps chromium   # Linux (installs system deps)
npx playwright install chromium                # macOS / Windows
npm run preflight                              # verify everything is ready
```

Optional OS-specific bootstraps (Xvfb, Keychain, DPAPI):

```bash
npm run setup:linux     # Xvfb + system deps
npm run setup:macos     # Keychain prompts
npm run setup:windows   # PowerShell DPAPI setup
```

## Quick start

```bash
npm run unibrowse -- status                          # start daemon
npm run unibrowse -- goto https://example.com        # navigate
npm run unibrowse -- snapshot                        # accessibility tree
npm run unibrowse -- screenshot /tmp/proof.png       # save screenshot
npm run unibrowse -- stop                            # stop daemon
```

The daemon persists between commands. No need to relaunch between navigations.

## Command reference

```text
status                                        # start daemon / check health
stop                                          # stop daemon
goto <url> [--no-challenge]                   # navigate (http/https only)
text                                          # page text content
snapshot                                      # accessibility tree
click <selector> [--timeout ms]               # click element
fill <selector> <value> [--timeout ms]        # fill input
wait <ms>                                     # wait N milliseconds
scroll <up|down> <pixels>                     # scroll page
eval <js expression>                          # evaluate JS in page
execute <javascript>                          # run JS in page context (fast)
batch <cmd1> <cmd2> ... [--json '<array>']    # multiple commands in 1 round-trip
viewport <w>x<h>                              # set viewport size
screenshot [path]                             # save screenshot
console                                       # browser console logs
network                                       # network activity log
cookies                                       # list cookies (values redacted)
cookie-import <json-file>                     # import cookies from JSON
cookie-import <json-file> --allow-plaintext-cookies
launch-with-profile <chrome|brave|edge> [--profile name]
```

## Speed: batch and execute

For multi-step actions, use `batch` (one HTTP round-trip) or `execute` (direct JS eval):

```bash
# Batch: multiple commands in 1 call
npm run unibrowse -- batch \
  'fill #email user@test.com' \
  'fill #password pass123' \
  'click button[type=submit]'

# Windows PowerShell: use --json
npm run unibrowse -- batch --json '["fill #email user@test.com","click #submit"]'

# Execute: direct DOM manipulation (fastest)
npm run unibrowse -- execute "document.querySelector('#email').value='test@test.com'"

# Skip challenge detection for known-safe URLs
npm run unibrowse -- goto https://internal-app.example.com --no-challenge
```

## Cookie import and session transfer

Import cookies from a JSON file for authenticated browsing:

```bash
npm run unibrowse -- cookie-import /tmp/cookies.json
```

Or relaunch with a real browser profile (bypasses cookie decryption entirely):

```bash
npm run unibrowse -- launch-with-profile brave --profile Default
```

The cookie engine decrypts Chromium-format cookies per platform:

| Platform | Method |
|----------|--------|
| macOS | PBKDF2-SHA1 + Keychain (`Chrome Safe Storage`) |
| Linux v10 | PBKDF2-SHA1, hardcoded password `peanuts` |
| Linux v11 | PBKDF2-SHA1 + `secret-tool` (GNOME keyring) |
| Windows | AES-256-GCM + DPAPI master key from `Local State` |

Windows App-Bound Encryption (ABE) is detected and rejected with `abe_unsupported` — use `launch-with-profile` or JSON import as fallback.

## AI CLI integration

### Claude Code (recommended)

Install the skill natively — this copies the full skill directory (SKILL.md + all references/) to Claude's skill scope:

```bash
npm run install:claude:project     # project scope
npm run install:claude:personal    # personal scope
```

Verify:

```bash
ls ~/.claude/skills/universal-browse/references/
# ai-cli-integration.md  linux-vps.md  macos.md  troubleshooting.md  windows.md
```

### Claude.ai (Web)

Generate an uploadable zip for Settings > Capabilities > Skills:

```bash
npm run install:claude:zip
# produces universal-browse-skill.zip at repo root
```

### Other AI CLIs

| Tool | Instruction file | Install |
|------|-----------------|---------|
| Codex CLI | `AGENTS.md` / `AGENTS.override.md` | Copy instruction block from `references/ai-cli-integration.md` |
| OpenCode | `AGENTS.md` (via `/init`) | Same |
| OpenClaw | `skills/universal-browse/SKILL.md` | `cp -r skill/universal-browse <workspace>/skills/universal-browse` |
| Gemini CLI | `GEMINI.md` | Copy instruction block from `references/ai-cli-integration.md` |
| Kimi Code CLI | `AGENTS.md` (via `/init`) | Same |
| IDE agents | Workspace rules file | Same |

For a complete integration playbook with interactive bootstrap prompts, see `skill/universal-browse/references/ai-cli-integration.md`.

## How it works

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
│ - /health, /command, /cookie-picker*             │
└─────────────┬────────────────────────────────────┘
              │
┌─────────────▼────────────────────────────────────┐
│ Browser Manager (src/browser-manager.js)         │
│ - persistent Playwright context                  │
│ - command execution + logs + cookie hooks         │
└─────────────┬────────────────────────────────────┘
              │
      ┌───────▼────────┐      ┌─────────────────────────┐
      │ Playwright     │      │ Cookie Import Engine    │
      │ Chromium       │◄────►│ - SQLite profile reads  │
      │ session        │      │ - v10/v11 decryption    │
      └────────────────┘      └─────────────────────────┘
```

1. CLI checks `.universal-browse/state.json`
2. Starts daemon if missing or stale
3. Daemon launches Chromium with environment-aware display strategy
4. Commands execute in a persistent browser context with bearer auth

## Compatibility

| Environment | Mode | Notes |
|-------------|------|-------|
| Linux desktop | headed + headless | |
| Linux VPS/CI | headless (default) | |
| Linux VPS headed | auto Xvfb | Needs `xvfb` installed |
| macOS | headed + headless | |
| Windows | headed + headless | |

Environment variables:

- `UNIVERSAL_BROWSE_MODE=headless|headed`
- `UNIVERSAL_BROWSE_XVFB=0|1`

## Challenge handling

`goto` auto-detects Cloudflare and anti-bot challenges. In headless mode, the daemon switches to headed mode before retrying. A screenshot is captured and common interactions are attempted automatically.

If CAPTCHA or MFA blocks automation: start headed mode (`UNIVERSAL_BROWSE_MODE=headed`), complete the manual step in the visible window, then resume with `snapshot`.

## Security model

- Daemon binds to `127.0.0.1` only
- Bearer token required for all commands
- Cookie values redacted in `cookies` output
- HTTP 500 responses never expose internal error messages
- URL protocol validated (http/https only)
- Optional strict mode: `UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK=1`

## Known limitations

- Google login may block Playwright browsers ("This browser or app may not be secure"), even in headed mode. Use `launch-with-profile` with a real profile for Google properties.
- Windows ABE (App-Bound Encryption) in recent Chrome/Brave versions blocks direct cookie decryption — use JSON import or `launch-with-profile`.

## Development

```bash
npm test                # unit tests
npm run lint            # ESLint
npm run test:coverage   # coverage check (30% lines, 60% branches)
npm run preflight       # runtime readiness
```

## Project structure

```text
universal-browse/
├── src/
│   ├── cli.js                    # CLI client
│   ├── server.js                 # Local HTTP daemon
│   ├── browser-manager.js        # Command execution
│   ├── display-strategy.js       # Headless/headed/Xvfb detection
│   ├── http-helpers.js           # HTTP utilities + auth
│   ├── cookie-import-browser.js  # Chromium cookie decryption
│   ├── cookie-picker-routes.js   # Cookie picker API endpoints
│   └── cookie-picker-ui.js       # Cookie picker UI
├── skill/universal-browse/
│   ├── SKILL.md                  # Claude Code skill definition
│   ├── references/               # Platform-specific docs
│   └── tests/eval.json           # Skill trigger evaluation tests
├── scripts/
│   ├── preflight.js              # Environment checks
│   ├── install-claude-skill.js   # Skill installer (recursive copy)
│   ├── setup-linux.sh            # Linux bootstrap
│   ├── setup-macos.sh            # macOS bootstrap
│   └── setup-windows.ps1         # Windows bootstrap
├── eslint.config.js
├── .husky/pre-commit
└── .github/workflows/ci.yml
```

## Architecture decisions

**HTTP on localhost over Unix sockets:** Ensures Windows compatibility without platform-specific transport code. Any HTTP client can debug the daemon.

**Plain ESM JavaScript:** No build step, minimal dependencies, directly executable with `node`. The codebase is small enough that compiler-level type safety is not required.

**No browser integration tests in CI:** Full Playwright launch tests are excluded from CI to avoid flaky headless issues across platforms. The smoke flow is validated via `preflight` and manual testing.

## License

MIT. See `LICENSE`.
