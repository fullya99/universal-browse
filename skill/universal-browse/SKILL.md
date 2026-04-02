---
name: universal-browse
description: Universal browser QA and dogfooding workflow using a persistent Playwright daemon with Linux/macOS/Windows and VPS support. Use when asked to open a URL, test a user flow, verify UI behavior, collect screenshots, or debug browser console/network issues.
license: MIT
compatibility: Works on Linux, macOS, and Windows, including Linux VPS/headless environments. Optional virtual display support via Xvfb for headed sessions on servers without a physical display.
metadata:
  owner: universal-browse
  version: 1.0.0
---

# universal-browse

Use this skill to validate web behavior quickly and repeatedly in a persistent browser session.

## Setup

1. Run preflight once:

```bash
npm run preflight
```

2. Install browsers/deps if needed:

```bash
npx playwright install --with-deps chromium
```

## Command patterns

```bash
npx unibrowse goto https://your-app.example
npx unibrowse text
npx unibrowse snapshot
npx unibrowse click "button[type='submit']"
npx unibrowse fill "#email" "dev@example.com"
npx unibrowse screenshot /tmp/proof.png
npx unibrowse console
npx unibrowse network
npx unibrowse cookie-import /tmp/cookies.json
npx unibrowse cookie-import-browser chrome --domain .github.com --profile Default
npx unibrowse cookie-import-browser chrome
```

## Cookie importer (full suite)

- `cookie-import <json-file>` imports Playwright-style cookies from local JSON.
- `cookie-import-browser <browser> --domain <domain> [--profile <profile>]` decrypts and imports from installed Chromium-based browsers.
- `cookie-import-browser <browser>` opens the local cookie picker UI for profile/domain selection.
- Picker routes are local-only (`127.0.0.1`) and token-protected for data/action requests.

## Linux VPS strategy

- Default mode is headless for best compatibility.
- For headed mode on servers, set `UNIVERSAL_BROWSE_MODE=headed`.
- If no display exists, the CLI auto-uses `xvfb-run` when installed.

See details:
- `references/linux-vps.md`
- `references/macos.md`
- `references/windows.md`
- `references/troubleshooting.md`

## Handoff protocol

If CAPTCHA/MFA blocks automation:

1. Start headed mode:

```bash
UNIVERSAL_BROWSE_MODE=headed npx unibrowse status
```

2. Ask the user to complete the manual step.
3. Continue with snapshot + assertions.
