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
- Windows DPAPI decryption fails:
  - ensure you run from the same Windows user account that owns the browser profile.
  - verify PowerShell is available (`powershell -Command "$PSVersionTable.PSVersion"` or `pwsh -Command "$PSVersionTable.PSVersion"`).
- `db_locked`:
  - close the browser fully, then retry import.

## Claude Code native/plugin install issues

- `claude plugin add` fails with `unknown command 'add'`:
  - use `claude plugin validate .` then `claude --plugin-dir .` for local plugin development.
  - for persistent plugin installs, use `claude plugin install <plugin>@<marketplace>`.
- `No manifest found` during plugin validation:
  - ensure `.claude-plugin/plugin.json` exists at repository root.
- Need deterministic native install without marketplace:
  - project scope: `npm run install:claude:project`
  - personal scope: `npm run install:claude:personal`
