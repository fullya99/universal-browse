# universal-browse

[![Node 20+](https://img.shields.io/badge/node-20%2B-2f7d32?style=flat-square)](https://nodejs.org)
[![Playwright 1.58+](https://img.shields.io/badge/playwright-1.58%2B-2e8b57?style=flat-square)](https://playwright.dev)
[![CI](https://github.com/fullya99/universal-browse/actions/workflows/ci.yml/badge.svg)](https://github.com/fullya99/universal-browse/actions/workflows/ci.yml)
[![OS Support](https://img.shields.io/badge/support-linux%20%7C%20macOS%20%7C%20windows%20%7C%20VPS-0f766e?style=flat-square)](#compatibility)
[![Headless + Headed](https://img.shields.io/badge/mode-headless%20%2B%20headed-1d4ed8?style=flat-square)](#compatibility)
[![License MIT](https://img.shields.io/badge/license-MIT-111827?style=flat-square)](./LICENSE)

Persistent Playwright daemon + CLI for AI-assisted QA, dogfooding, and web automation.

`unibrowse` keeps a browser session alive across commands, so agents and developers can navigate, inspect, interact, and collect evidence without relaunching Playwright every step.

## Why universal-browse

- Persistent browser context across commands (faster iterative QA)
- One-command setup on Linux, macOS, Windows, and VPS
- Built-in evidence capture: `snapshot`, `text`, `screenshot`, `console`, `network`
- Auth workflows supported via cookie import and profile reuse
- Native skill packaging for Claude Code + integration docs for Codex/OpenCode/Gemini/Kimi/OpenClaw

## Install (one command)

```bash
git clone https://github.com/fullya99/universal-browse.git
cd universal-browse
npm run setup
```

`npm run setup` installs dependencies, downloads Chromium, applies platform bootstrap when needed, and runs preflight checks.

Manual install option:

```bash
npm ci
npx playwright install --with-deps chromium   # Linux
npx playwright install chromium                # macOS / Windows
npm run preflight
```

## 30-second smoke test

```bash
npm run unibrowse -- status
npm run unibrowse -- goto https://example.com
npm run unibrowse -- snapshot
npm run unibrowse -- screenshot /tmp/proof.png
npm run unibrowse -- stop
```

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
batch <cmd1> <cmd2> ... [--json '<array>']   # multiple commands in one round-trip
viewport <w>x<h>                              # set viewport size
screenshot [path]                             # save screenshot
console                                       # browser console logs
network                                       # network activity log
cookies                                       # list cookies (values redacted)
cookie-import <json-file>                     # import cookies from JSON
cookie-import <json-file> --allow-plaintext-cookies
launch-with-profile <chrome|brave|edge> [--profile name]
```

## Fast workflows

Use `batch` for multiple CLI actions in one call:

```bash
npm run unibrowse -- batch \
  'fill #email user@test.com' \
  'fill #password pass123' \
  'click button[type=submit]'
```

Windows PowerShell (`--json` mode):

```bash
npm run unibrowse -- batch --json '["fill #email user@test.com","click #submit"]'
```

Use `execute` for direct JS execution (lowest overhead):

```bash
npm run unibrowse -- execute "document.querySelector('#email').value='test@test.com'"
```

Known-safe target? Skip challenge detection:

```bash
npm run unibrowse -- goto https://internal-app.example.com --no-challenge
```

## Authentication and session transfer

Import cookies from JSON:

```bash
npm run unibrowse -- cookie-import /tmp/cookies.json
```

Or launch with a real browser profile:

```bash
npm run unibrowse -- launch-with-profile brave --profile Default
```

Cookie engine support by platform:

| Platform | Method |
|----------|--------|
| macOS | PBKDF2-SHA1 + Keychain (`Chrome Safe Storage`) |
| Linux v10 | PBKDF2-SHA1 with password `peanuts` |
| Linux v11 | PBKDF2-SHA1 + `secret-tool` (GNOME keyring) |
| Windows | AES-256-GCM + DPAPI master key from `Local State` |

Windows App-Bound Encryption (ABE) is detected and returned as `abe_unsupported`. Use `launch-with-profile` or JSON cookie import in that case.

## AI CLI integration

### Claude Code (native skill install)

```bash
npm run install:claude:project
npm run install:claude:personal
```

Verify installation:

```bash
ls ~/.claude/skills/universal-browse/references/
```

### Claude.ai (Web)

```bash
npm run install:claude:zip
```

This generates `universal-browse-skill.zip` at repo root for upload in Settings -> Capabilities -> Skills.

### Other CLIs and IDE agents

| Tool | Native file/location | Install path |
|------|----------------------|--------------|
| Codex CLI | `AGENTS.md` / `AGENTS.override.md` | Use `skill/universal-browse/references/ai-cli-integration.md` |
| OpenCode | `AGENTS.md` | Use `skill/universal-browse/references/ai-cli-integration.md` |
| Gemini CLI | `GEMINI.md` | Use `skill/universal-browse/references/ai-cli-integration.md` |
| Kimi Code CLI | `AGENTS.md` | Use `skill/universal-browse/references/ai-cli-integration.md` |
| OpenClaw | `<workspace>/skills/universal-browse/SKILL.md` | `cp -r skill/universal-browse <workspace>/skills/universal-browse` |
| IDE agents | Workspace rules/instructions | Use shared instruction block |

Full playbook: `skill/universal-browse/references/ai-cli-integration.md`

## How it works

```text
Agent / Developer / CI
        |
        | unibrowse <command>
        v
CLI Client (src/cli.js)
        |
        | localhost + bearer token
        v
Local Daemon (src/server.js)
        |
        v
Browser Manager (src/browser-manager.js)
        |
        +--> Playwright Chromium session (persistent)
        +--> Cookie Import Engine (profile DB reads + decryption)
```

Flow:

1. CLI reads `.universal-browse/state.json`
2. Daemon starts when missing or stale
3. Browser launches with environment-aware display strategy
4. Commands execute against a persistent context with auth and logs

## Compatibility

| Environment | Mode | Notes |
|-------------|------|-------|
| Linux desktop | headed + headless | |
| Linux VPS/CI | headless (default) | |
| Linux VPS headed | auto Xvfb | Requires `xvfb` |
| macOS | headed + headless | |
| Windows | headed + headless | |

Environment variables:

- `UNIVERSAL_BROWSE_MODE=headless|headed`
- `UNIVERSAL_BROWSE_XVFB=0|1`

## Challenge handling

`goto` can detect Cloudflare and anti-bot challenge pages.

- In headless mode, daemon attempts headed fallback before retrying.
- Screenshot evidence is captured during challenge handling.
- Common interactions are attempted automatically.

If CAPTCHA or MFA blocks automation, run headed mode, complete the step manually, then continue with `snapshot`.

## Security model

- Daemon binds to `127.0.0.1` only
- Bearer token required for all commands
- Cookie values redacted in `cookies` output
- HTTP 500 responses do not expose internal details
- URL protocol validated (`http` / `https` only)
- Optional strict mode: `UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK=1`

## Known limitations

- Google login may block automation browsers, even in headed mode. Prefer `launch-with-profile` for Google properties.
- On recent Chrome/Brave on Windows, ABE can block direct cookie decryption. Use JSON import or profile launch.

## Development

```bash
npm test
npm run lint
npm run test:coverage
npm run preflight
```

## Project structure

```text
universal-browse/
├── src/
│   ├── cli.js
│   ├── server.js
│   ├── browser-manager.js
│   ├── display-strategy.js
│   ├── http-helpers.js
│   ├── cookie-import-browser.js
│   ├── cookie-picker-routes.js
│   └── cookie-picker-ui.js
├── skill/universal-browse/
│   ├── SKILL.md
│   ├── references/
│   └── tests/eval.json
├── scripts/
│   ├── setup.js                  # One-command cross-platform setup
│   ├── postinstall.js            # Auto-install Chromium after npm install
│   ├── preflight.js              # Environment checks
│   └── install-claude-skill.js   # Skill installer (recursive copy)
├── eslint.config.js
├── .husky/pre-commit
└── .github/workflows/ci.yml
```

## Architecture notes

- `localhost` HTTP transport instead of Unix sockets for cross-platform behavior (especially Windows)
- Plain ESM JavaScript with no build step
- Browser integration tests are excluded from CI to avoid flaky cross-platform Playwright startup behavior

## License

MIT. See `LICENSE`.
