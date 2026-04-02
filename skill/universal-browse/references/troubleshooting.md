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
- Sensitive cookie JSON on disk:
  - cookie export files can contain live session tokens (`auth_token`, `ct0`, etc.).
  - delete temporary cookie files immediately after import.
- Plaintext cookie import policy:
  - default behavior allows plaintext JSON imports (operator responsibility).
  - to enforce acknowledgement in stricter environments, set `UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK=1` and require `--allow-plaintext-cookies`.

## Claude Code native install issues

- Skill not found after install:
  - rerun the installer with the intended scope.
  - verify `SKILL.md` exists in the selected native path.
- Need deterministic native install without marketplace:
  - project scope: `npm run install:claude:project`
  - personal scope: `npm run install:claude:personal`
