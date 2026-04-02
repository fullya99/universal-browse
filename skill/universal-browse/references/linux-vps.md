# Linux VPS Guide

## Recommended defaults

- Use `UNIVERSAL_BROWSE_MODE=headless` for CI and servers.
- Install Chromium dependencies with `npx playwright install --with-deps chromium`.

## Headed sessions without physical display

Set:

```bash
UNIVERSAL_BROWSE_MODE=headed
```

When `DISPLAY`/`WAYLAND_DISPLAY` is missing, the CLI can wrap server startup with `xvfb-run`.

Install Xvfb:

```bash
sudo apt-get update
sudo apt-get install -y xvfb
```

## Security

- Browser daemon binds only to `127.0.0.1`.
- Commands require bearer token from local state file.
- In containers/root mode, no-sandbox fallback may be used.
