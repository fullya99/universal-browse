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

## Typical workflow

```powershell
npx unibrowse goto https://example.com
npx unibrowse snapshot
npx unibrowse screenshot "$env:TEMP\win-proof.png"
```
