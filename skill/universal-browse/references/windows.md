# Windows Guide

## Setup

```powershell
npm run setup:windows
```

## Modes

- Headless is default and recommended for automation.
- Headed works when `UNIVERSAL_BROWSE_MODE=headed`.

## Cookie importer notes

- Direct browser-cookie decrypt/import is retired on Windows for reliability.
- Preferred paths are:
  - native profile mode (`launch-with-profile`) for real authenticated browsing,
  - JSON cookie import (`cookie-import`) when you explicitly control exported cookie files.
- If `UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK=1` is enabled, append `--allow-plaintext-cookies` to `cookie-import`.

## Native profile mode

- Use `npm run unibrowse -- launch-with-profile <chrome|brave|edge> --profile Default` to run with a real browser profile.
- Close the browser first to avoid lock conflicts.
- This mode exposes live profile state (sessions, cookies, site data) to automation; handle outputs carefully.

## Google sign-in limitation

- Google can block Playwright-driven login flows with "This browser or app may not be secure".
- Google services can also reject imported cookies from an already logged-in session when replayed in a fresh Playwright context (device/session binding checks).
- Recommended path: sign in and continue Google workflows in a regular Chrome/Brave profile instead of relying on cookie replay.

## Typical workflow

```powershell
npx unibrowse goto https://example.com
npx unibrowse snapshot
npx unibrowse screenshot "$env:TEMP\win-proof.png"
```
