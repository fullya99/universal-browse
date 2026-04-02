# Troubleshooting

## Failed to launch browser

- Run: `DEBUG=pw:browser npx unibrowse status`
- Verify dependencies: `npm run preflight`
- Reinstall browsers: `npx playwright install --with-deps chromium`

## Headed mode on Linux fails

- Install Xvfb: `sudo apt-get install -y xvfb`
- Retry with `UNIVERSAL_BROWSE_MODE=headed`

## Stale daemon state

```bash
npx unibrowse stop
npx unibrowse status
```

## Auth errors

- Do not edit `.universal-browse/state.json` manually.
- Restart daemon with `npx unibrowse stop`, then run a command again.

## Cookie importer issues

- `keychain_denied` / `keychain_timeout` on macOS:
  - approve the Keychain prompt for the browser safe storage entry.
- Linux `v11` decryption fails:
  - ensure `secret-tool` is installed and keyring is unlocked.
- `db_locked`:
  - close the browser fully, then retry import.
