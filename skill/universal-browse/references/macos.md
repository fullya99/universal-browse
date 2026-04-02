# macOS Guide

## Setup

```bash
npm install
npx playwright install chromium
```

## Modes

- Headless is default and fastest for automation.
- Headed works when `UNIVERSAL_BROWSE_MODE=headed`.

## Typical workflow

```bash
npx unibrowse goto https://example.com
npx unibrowse snapshot
npx unibrowse screenshot /tmp/macos-proof.png
```
