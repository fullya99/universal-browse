---
name: universal-browse
description: "Persistent Playwright browser daemon for QA testing, dogfooding, and web automation across Linux, macOS, Windows, and headless VPS environments. Use when asked to open a URL, browse a website, test a user flow, verify UI behavior, collect screenshots, debug browser console or network issues, run smoke tests, check responsive layouts, verify deployments, test forms, handle authentication flows, inspect cookies, or any browser-based validation. Also triggers on browse, open this page, check this site, take a screenshot, test this URL, verify the deploy, QA this, dogfood, smoke test."
license: MIT
compatibility: "Node.js 20 or later. Works on Linux (desktop and VPS), macOS, and Windows. Optional Xvfb for headed sessions on headless Linux servers."
allowed-tools: "Bash(npm:*) Bash(npx:*) Bash(node:*) Bash(unibrowse:*) Bash(lsof:*) Bash(curl:*)"
metadata:
  version: 1.0.0
  tags: [browser, qa, testing, playwright, automation, screenshots]
---

# universal-browse

Validate web behavior quickly and repeatedly via a persistent browser daemon.

## Instructions

### Step 1: Setup (one command, all platforms)

Run setup to install all dependencies including Playwright Chromium:

```bash
npm run setup
```

This single command handles `npm install`, Chromium browser download (with system deps on Linux), and preflight verification. Expected output: all checks PASS.

If setup already completed (or you only want to verify):

```bash
npm run preflight
```

If preflight reports Chromium missing:

```bash
npx playwright install chromium                # macOS / Windows
npx playwright install --with-deps chromium   # Linux (installs system deps)
```

### Step 2: Start a session and navigate

```bash
npm run unibrowse -- status                          # start daemon if needed
npm run unibrowse -- goto https://your-app.example   # navigate
npm run unibrowse -- snapshot                        # get accessibility tree
npm run unibrowse -- text                            # get page text
```

The daemon persists across commands. No need to relaunch between navigations.

### Step 3: Interact with the page

```bash
npm run unibrowse -- click "button[type='submit']"
npm run unibrowse -- fill "#email" "dev@example.com"
npm run unibrowse -- scroll down 1200
npm run unibrowse -- eval "document.title"
npm run unibrowse -- execute "document.querySelector('#email').value='test@test.com'; document.querySelector('#submit').click()"
npm run unibrowse -- viewport 375x812              # mobile viewport
```

#### Batch commands (fastest for multi-step actions)

```bash
# Execute multiple actions in a single round-trip
npm run unibrowse -- batch \
  'fill #email user@test.com' \
  'fill #password pass123' \
  'click button[type=submit]'

# Windows PowerShell: use --json mode
npm run unibrowse -- batch --json '["fill #email user@test.com","fill #password pass123","click button[type=submit]"]'
```

### Step 4: Collect evidence

```bash
npm run unibrowse -- screenshot /tmp/proof.png
npm run unibrowse -- console                       # browser console logs
npm run unibrowse -- network                       # network activity
npm run unibrowse -- cookies                       # cookies (values redacted)
```

### Step 5: Session transfer (authenticated pages)

Import cookies from a JSON file:

```bash
npm run unibrowse -- cookie-import /tmp/cookies.json
```

Or relaunch with a real browser profile for sites that reject cookie replay:

```bash
npm run unibrowse -- launch-with-profile brave --profile Default
```

Read `references/troubleshooting.md` for cookie decryption errors and database locking issues.

### Step 6: Stop the daemon

```bash
npm run unibrowse -- stop
```

## Platform-specific setup

Read the relevant reference for your environment:

- Read `references/macos.md` for macOS-specific setup and keychain access.
- Read `references/windows.md` for PowerShell setup and DPAPI cookie decryption.
- Read `references/linux-vps.md` for headless VPS setup with Xvfb virtual display.
- Read `references/ai-cli-integration.md` for registering this skill in Codex, OpenCode, Gemini, or Kimi.

## Speed tips

- **Use `execute` for simple DOM manipulation** (fastest — single JS eval, no selector waits)
- **Use `batch` for mixed actions** (fast — multiple commands in one HTTP round-trip)
- **Use individual commands only for single operations** or when you need per-command output
- **Use `--no-challenge` on `goto`** when navigating to known-safe URLs (skips challenge detection, saves 2-5s)
- **Use `--timeout <ms>` on `click`/`fill`** to override the default 5s element wait

## Challenge protocol

`goto` auto-detects Cloudflare and anti-bot challenge pages. Use `--no-challenge` to skip detection for known-safe URLs.
In headless mode, the daemon attempts to switch to headed mode before retrying.
A screenshot is captured and common challenge interactions are attempted automatically.

## Handoff protocol

If CAPTCHA or MFA blocks automation:

1. Start headed mode: `UNIVERSAL_BROWSE_MODE=headed npx unibrowse status`
2. Ask the user to complete the manual step in the visible browser window.
3. Resume with `snapshot` and assertions.

## Examples

### Example 1: Quick smoke test after deploy

**User says:** "Check if staging.example.com loads correctly after the deploy"

**Actions:**
1. `npm run unibrowse -- goto https://staging.example.com`
2. `npm run unibrowse -- snapshot`
3. `npm run unibrowse -- screenshot /tmp/staging-check.png`

**Result:** Accessibility tree confirms page structure, screenshot saved as evidence.

### Example 2: Fill and submit a form (batch — fast)

**User says:** "Test the login form on our app"

**Actions:**
1. `npm run unibrowse -- goto https://app.example.com/login`
2. `npm run unibrowse -- batch 'fill #email test@example.com' 'fill #password testpass123' 'click button[type=submit]'`
3. `npm run unibrowse -- snapshot`

**Result:** Form submitted in a single round-trip, snapshot shows post-login page content.

### Example 2b: Fill and submit a form (execute — fastest)

**User says:** "Test the login form, make it fast"

**Actions:**
1. `npm run unibrowse -- goto https://app.example.com/login`
2. `npm run unibrowse -- execute "document.querySelector('#email').value='test@example.com'; document.querySelector('#password').value='testpass123'; document.querySelector('button[type=submit]').click()"`
3. `npm run unibrowse -- snapshot`

**Result:** Form submitted via direct DOM manipulation, minimal latency.

### Example 3: Debug network issues

**User says:** "Why is the dashboard slow? Check network calls"

**Actions:**
1. `npm run unibrowse -- goto https://app.example.com/dashboard`
2. `npm run unibrowse -- network`
3. `npm run unibrowse -- console`

**Result:** Network log reveals slow API calls, console shows any JS errors.

### Example 4: Mobile responsive check

**User says:** "Check if the landing page works on mobile"

**Actions:**
1. `npm run unibrowse -- viewport 375x812`
2. `npm run unibrowse -- goto https://example.com`
3. `npm run unibrowse -- screenshot /tmp/mobile.png`
4. `npm run unibrowse -- snapshot`

**Result:** Screenshot and DOM tree at iPhone viewport dimensions.

## Known limitations

- Google account login may block Playwright browsers ("This browser or app may not be secure"), even in headed mode.
- Google services can reject exported cookies due to device/session binding.
- Workaround: use `launch-with-profile` with a real browser profile for Google properties.
- In strict environments with `UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK=1`, add `--allow-plaintext-cookies` flag.

## Troubleshooting

### Error: Daemon won't start or port conflict

**Cause:** Stale state file from a crashed session.
**Solution:** `rm -rf .universal-browse/state.json && npm run unibrowse -- status`

### Error: Browser launch fails on Linux VPS

**Cause:** Missing display server and no Xvfb installed.
**Solution:** `sudo apt-get install -y xvfb` then retry, or use `UNIVERSAL_BROWSE_MODE=headless`.

### Error: Cookie import fails with decryption error

**Cause:** Browser cookie database is locked or keychain access denied.
**Solution:** Close the source browser, retry. On macOS, authorize keychain access when prompted.
Read `references/troubleshooting.md` for detailed error codes and platform-specific fixes.

### Error: Snapshot returns empty content

**Cause:** Page hasn't finished loading or is behind a challenge.
**Solution:** `npm run unibrowse -- wait 3000` then retry `snapshot`. Check for challenge with `screenshot`.
