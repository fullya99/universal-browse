# Cross-Platform Skill Test Protocol (Temporary)

Goal: validate end-to-end behavior of `universal-browse` on Linux, macOS, and Windows before finalizing the Windows rollout.

Scope:
- Runtime daemon lifecycle (`status`, `stop`, auto-restart)
- Core browser commands (`goto`, `text`, `snapshot`, `click`, `fill`, `wait`, `viewport`, `screenshot`)
- Cookie import flows (`cookie-import`, `cookie-import-browser`, picker UI)
- Platform-specific dependencies and display strategy
- Security expectations (localhost binding, token-protected routes, safe file paths)

CLI invocation note:
- In a local clone, prefer `npm run unibrowse -- <command>`.
- `npx unibrowse` may not resolve unless the package is globally linked/installed.

## 1) Test Rules

- Run tests on real hosts (or CI runners) for each OS.
- Use Node >= 20.
- Capture all command outputs and errors.
- If a step fails, log the exact command, output, and environment details, then continue when possible.
- Always run both `headless` and `headed` checks on Windows because regressions may appear only in one mode.

## 2) Environment Matrix

- Linux desktop (headed + headless)
- Linux server or CI style env (headless; optional headed via Xvfb)
- macOS
- Windows

## 3) Preflight and Install

### Linux

```bash
npm ci
npx playwright install --with-deps chromium
npm run preflight
npm test
```

### macOS

```bash
npm ci
npx playwright install chromium
npm run preflight
npm test
```

### Windows (PowerShell)

```powershell
npm ci
npx playwright install chromium
npm run preflight
npm test
```

If the machine uses PowerShell 7 only, also verify:

```powershell
pwsh -Command "$PSVersionTable.PSVersion"
```

Expected:
- `npm test` passes.
- `npm run preflight` returns PASS for required checks.
- Optional WARNs are acceptable only for optional dependencies.

## 4) Core Runtime Smoke (All OS)

Run in repo root:

```bash
npx unibrowse stop
npx unibrowse status
npx unibrowse goto https://example.com
npx unibrowse text
npx unibrowse snapshot
npx unibrowse viewport 1366x768
npx unibrowse wait 300
npx unibrowse screenshot
npx unibrowse console
npx unibrowse network
```

Expected:
- Daemon starts automatically when needed.
- `status` returns strategy and URL.
- `goto/text/snapshot` return valid output.
- `screenshot` reports a real output path in OS temp dir when no path is provided.

## 5) Headed/Headless Strategy Validation

### Linux

```bash
UNIVERSAL_BROWSE_MODE=headless npx unibrowse status
UNIVERSAL_BROWSE_MODE=headed npx unibrowse status
UNIVERSAL_BROWSE_XVFB=0 UNIVERSAL_BROWSE_MODE=headed npx unibrowse status
```

Expected:
- Headless always works.
- Headed works with display.
- On display-less Linux: headed should use Xvfb when available; otherwise return clear missing-display error.

### macOS

```bash
UNIVERSAL_BROWSE_MODE=headless npx unibrowse status
UNIVERSAL_BROWSE_MODE=headed npx unibrowse status
```

Expected:
- Headless and headed both work natively.

### Windows (PowerShell)

```powershell
$env:UNIVERSAL_BROWSE_MODE="headless"; npx unibrowse status
$env:UNIVERSAL_BROWSE_MODE="headed"; npx unibrowse status
Remove-Item Env:UNIVERSAL_BROWSE_MODE
```

Expected:
- Headless and headed both work natively.

## 5.1) Windows Runtime Retest Script (Mandatory)

Run this exact sequence in PowerShell:

```powershell
npx unibrowse stop
$env:UNIVERSAL_BROWSE_MODE="headless"
npx unibrowse status
npx unibrowse goto https://example.com
npx unibrowse snapshot

$env:UNIVERSAL_BROWSE_MODE="headed"
npx unibrowse status
npx unibrowse goto https://example.com
npx unibrowse snapshot

Remove-Item Env:UNIVERSAL_BROWSE_MODE
npx unibrowse stop
```

Expected:
- No Node crash or abrupt process exit.
- `snapshot` returns content in both modes.
- If snapshot fails, it must return a controlled error message (no runtime assertion crash).

## 6) Cookie Import Validation

### 6.1 JSON Import (All OS)

Create a test cookie file in OS temp dir, then import:

```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path');const out=p.join(os.tmpdir(),'ub-cookies-test.json');fs.writeFileSync(out,JSON.stringify([{name:'ub_test',value:'1',domain:'example.com',path:'/'}],null,2));console.log(out)"
npx unibrowse goto https://example.com
npx unibrowse cookie-import "<path returned above>"
npx unibrowse cookies
```

Expected:
- Import succeeds only when JSON path is inside current working directory or OS temp dir.
- Invalid or out-of-scope paths fail with clear error.

### 6.2 Browser Profile Import

Use a logged-in Chromium profile before test.

```bash
npx unibrowse cookie-import-browser chrome --domain .github.com --profile Default
```

Also test at least one alternative browser if installed (`edge`, `brave`, `chromium`).

Expected:
- Returns imported cookie count.
- If some rows fail to decrypt, response includes failed count.

### 6.3 Picker UI Flow

```bash
npx unibrowse cookie-import-browser chrome
```

Expected:
- Opens local picker URL.
- Domain/profile can be selected and import executed.

## 7) Security and Safety Checks

Run these validations:

1. Localhost binding
   - Confirm daemon only serves `127.0.0.1`.
2. Auth protection
   - Calling protected routes without token fails.
3. Cookie JSON path restrictions
   - Reject paths outside cwd/temp.
4. No token leakage
   - Verify logs/CLI output do not print raw bearer token.

## 8) Platform-Specific Crypto Checks

### Linux
- Verify `v10` baseline works.
- If `secret-tool` is installed and keyring unlocked, verify `v11` path works.

### macOS
- Validate keychain prompt behavior and successful decryption after allow.

### Windows
- Validate decryption uses same user context as browser profile owner.
- Validate `Local State` key extraction + DPAPI unprotect + AES-GCM cookie decrypt path.
- If only `pwsh` exists, verify flow still works.

## 9) Regression Checklist

- `npm test` green after manual checks.
- `npm run preflight` green for required checks.
- No regression in Linux/macOS flows introduced by Windows changes.
- CI jobs expected for Linux, macOS, and Windows.
- `test/config.test.js` remains path-separator agnostic (no hardcoded `/tmp/...` assertions).

## 10) Defect Report Template

For each issue:

- ID: `OS-CATEGORY-###`
- OS/Version:
- Node version:
- Browser/version:
- Command executed:
- Expected behavior:
- Actual behavior:
- Full error output:
- Reproducible (always/sometimes):
- Severity (P0/P1/P2/P3):
- Suspected root cause:

## 11) Exit Criteria

Validation is complete when:

- All required smoke tests pass on Linux, macOS, and Windows.
- Cookie import works in each OS baseline scenario.
- Security checks pass.
- Remaining issues are documented with severity and repro steps.
