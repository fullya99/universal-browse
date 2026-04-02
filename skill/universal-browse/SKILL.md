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

For local repo execution without global install, use:

```bash
npm run unibrowse -- status
```

## Command patterns

```bash
npm run unibrowse -- goto https://your-app.example
npm run unibrowse -- text
npm run unibrowse -- snapshot
npm run unibrowse -- click "button[type='submit']"
npm run unibrowse -- fill "#email" "dev@example.com"
npm run unibrowse -- scroll down 1200
npm run unibrowse -- eval "document.title"
npm run unibrowse -- screenshot /tmp/proof.png
npm run unibrowse -- console
npm run unibrowse -- network
npm run unibrowse -- cookie-import /tmp/cookies.json
npm run unibrowse -- cookie-import-browser chrome --domain .github.com --profile Default
npm run unibrowse -- cookie-import-browser chrome --list-domains --profile Default
npm run unibrowse -- cookie-import-browser chrome
npm run unibrowse -- launch-with-profile brave --profile Default
```

## Cookie importer (full suite)

- `cookie-import <json-file>` imports Playwright-style cookies from local JSON.
- `cookie-import <json-file> --allow-plaintext-cookies` is accepted and can be required when `UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK=1`.
- `cookie-import-browser <browser> --domain <domain> [--profile <profile>]` decrypts and imports from installed Chromium-based browsers.
- `cookie-import-browser <browser> --list-domains [--profile <profile>]` prints domain inventory as text for automation/agents.
- `cookie-import-browser <browser>` opens the local cookie picker UI for profile/domain selection.
- `launch-with-profile <chrome|brave|edge> [--profile <name>]` relaunches runtime with a native browser profile (`User Data`) for sites that reject cookie replay in fresh contexts.
- Unknown flags on `cookie-import-browser` return an explicit usage error.
- Picker routes are local-only (`127.0.0.1`) and token-protected for data/action requests.
- `cookies` output masks cookie values by default; do not expose raw cookie files in logs.
- Launch-with-profile is sensitive: close the source browser first and treat automation output/logs as potentially containing live account data.

## Linux VPS strategy

- Default mode is headless for best compatibility.
- For headed mode on servers, set `UNIVERSAL_BROWSE_MODE=headed`.
- If no display exists, the CLI auto-uses `xvfb-run` when installed.

See details:
- `references/linux-vps.md`
- `references/macos.md`
- `references/windows.md`
- `references/ai-cli-integration.md`
- `references/troubleshooting.md`

## Handoff protocol

If CAPTCHA/MFA blocks automation:

1. Start headed mode:

```bash
UNIVERSAL_BROWSE_MODE=headed npx unibrowse status
```

2. Ask the user to complete the manual step.
3. Continue with snapshot + assertions.

## Known limitations

- Google account login (Gmail/Drive/GAIA) may block Playwright-driven browsers with "This browser or app may not be secure", even in headed mode.
- Google services can also reject already-authenticated exported cookies in a fresh Playwright context due to device/session binding controls.
- Preferred workaround for Google properties: keep authentication in a regular browser profile and avoid relying on cookie replay for session transfer.
- In strict environments with `UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK=1`, add `--allow-plaintext-cookies` to acknowledge handling of sensitive cookie JSON.
