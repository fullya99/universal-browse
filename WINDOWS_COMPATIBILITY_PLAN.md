# Windows Compatibility Plan

## Goal

Ship first-class Windows support for `universal-browse`, including daemon runtime and Chromium profile cookie import.

## Delivered in this branch

1. Cross-platform command discovery (`which`/`where`) in runtime checks.
2. Windows opener support for cookie picker (`cmd /c start`).
3. Temp paths switched to `os.tmpdir()` for cross-platform behavior.
4. Browser profile discovery support for `win32` paths.
5. Windows Chromium cookie decryption path:
   - `Local State` key lookup
   - DPAPI unprotect via PowerShell
   - AES-GCM cookie value decrypt for `v10`/`v11`/`v20`
   - DPAPI fallback for legacy encrypted blobs
6. CI now includes `windows-latest`.
7. Docs/skill/troubleshooting updated with Windows guidance.

## Validation checklist

1. Local smoke tests (Windows host):
   - `npm run setup:windows`
   - `npx unibrowse status`
   - `npx unibrowse goto https://example.com`
   - `npx unibrowse snapshot`
2. Cookie importer checks:
   - `npx unibrowse cookie-import-browser chrome --domain .github.com --profile Default`
   - `npx unibrowse cookie-import-browser chrome` (picker flow)
3. CI checks:
   - Linux, macOS, and Windows all green.

## Risks to monitor

1. Browser-version crypto format changes (especially new Windows prefixes).
2. PowerShell availability/policy restrictions in locked-down enterprise images.
3. Edge/Chrome profile location differences on non-standard installations.

## Next hardening steps

1. Add fixture-based unit tests for Windows decrypt path.
2. Add integration smoke on a seeded Windows profile in CI.
3. Emit clearer user-facing error codes for DPAPI/local-state failures.
