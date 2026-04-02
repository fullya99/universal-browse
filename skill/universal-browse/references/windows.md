# Windows Guide

## Setup

```powershell
npm run setup:windows
```

## Modes

- Headless is default and recommended for automation.
- Headed works when `UNIVERSAL_BROWSE_MODE=headed`.

## Cookie importer notes

- Browser profile import uses Windows DPAPI + Chromium `Local State` key extraction.
- If import fails, close the source browser completely and retry.
- On Chromium/Brave with App-Bound Encryption (ABE), direct decrypt may fail for all cookies; use JSON export + `cookie-import` fallback.
- If `UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK=1` is enabled, append `--allow-plaintext-cookies` to `cookie-import`.

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
