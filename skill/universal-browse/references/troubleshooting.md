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
- Windows App-Bound Encryption detected (`abe_unsupported`):
  - Chromium profile uses `app_bound_encrypted_key`; direct browser-cookie decrypt/import is intentionally disabled.
  - use native profile mode instead: `npm run unibrowse -- launch-with-profile brave --profile Default` (or chrome/edge).
- `db_locked`:
  - close the browser fully, then retry import.
- `launch-with-profile` fails with lock/singleton error:
  - close Chrome/Brave/Edge completely (all background processes), then retry.
- `launch-with-profile` starts but auth behavior is unexpected:
  - ensure the same browser family/profile was selected (`--profile Default` vs `Profile N`).
  - note: support is currently Chrome/Brave/Edge.
- Sensitive cookie JSON on disk:
  - cookie export files can contain live session tokens (`auth_token`, `ct0`, etc.).
  - delete temporary cookie files immediately after import.
- Plaintext cookie import policy:
  - default behavior allows plaintext JSON imports (operator responsibility).
  - to enforce acknowledgement in stricter environments, set `UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK=1` and require `--allow-plaintext-cookies`.
- Picker UI shows `Failed to fetch`:
  - recent builds include HTTP status/body in UI error text.
  - inspect daemon stderr for `[cookie-picker]` endpoint error logs.

## Google account login blocked in automation browser

- Symptom: Google sign-in shows "This browser or app may not be secure".
- Cause: Google may block sign-ins from browsers controlled by software automation.
- Related symptom: `cookie-import` succeeds but Gmail/Drive/Docs still redirects to `accounts.google.com`.
- Related cause: Google session cookies can be validated against device/session binding signals and rejected when replayed in a fresh Playwright browser context.
- Workaround:
  - complete and keep Google-authenticated workflows in a regular browser profile,
  - do not rely on cookie replay as a guaranteed auth transfer for Google properties.

## Cloudflare challenge and TLS fingerprinting

- Symptom: `goto` lands on challenge page (`Just a moment...` / `Checking your browser`).
- Runtime behavior: `goto` detects challenge patterns, attempts headed mode, captures screenshot, and tries common challenge clicks.
- Limitation: some sites still block automation due to TLS/client fingerprint signals (JA3/JA4 style), even in headed/native profile mode.

## Speed optimization

- **Slow form fills (10+ fields):** Use `batch` to combine all fill/click actions into a single HTTP round-trip. Example: `npm run unibrowse -- batch 'fill #email user@test.com' 'fill #password pass' 'click #submit'`
- **Slow form fills (simple DOM):** Use `execute` for direct JavaScript evaluation: `npm run unibrowse -- execute "document.querySelector('#email').value='test@test.com'"`
- **Slow navigation to known-safe URLs:** Add `--no-challenge` to skip challenge detection: `npm run unibrowse -- goto https://internal-app.example.com --no-challenge`
- **Slow click/fill on elements:** Default timeout is 5s (reduced from 30s). Override with `--timeout <ms>` if needed.
- **Slow browser startup on Windows:** OS-specific launch flags (`--disable-gpu`) are now applied automatically.
- **Windows PowerShell batch syntax:** Use `--json` mode: `npm run unibrowse -- batch --json '["fill #email user@test.com","click #submit"]'`

## Claude Code native install issues

- Skill not found after install:
  - rerun the installer with the intended scope.
  - verify `SKILL.md` exists in the selected native path.
- Need deterministic native install without marketplace:
  - project scope: `npm run install:claude:project`
  - personal scope: `npm run install:claude:personal`
