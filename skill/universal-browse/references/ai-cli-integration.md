# AI CLI and IDE Integration (Turnkey)

This document gives a single integration contract so `universal-browse` can be plugged into most AI terminal tools and IDE agents with minimal manual work.

## 1) Integration contract

Every tool-specific setup should enforce these rules:

- Use `npm run unibrowse -- <command>` as the default runtime command.
- Run `npm run preflight` before debugging runtime failures.
- Never print or store raw daemon bearer tokens.
- Keep daemon local-only (`127.0.0.1`).
- Do not commit/push automatically during setup.

## 2) One prompt to install and validate

Copy/paste this prompt into your AI CLI:

```text
You are in the root of the universal-browse repository.

Goal:
- install dependencies
- run OS-specific setup
- validate runtime
- produce a short PASS/FAIL report

Constraints:
- no git commit/push
- no destructive git commands
- do not modify source files
- show each command before running it

Run:
1) git pull origin main
2) node -v && npm -v
3) npm ci
4) Install browser:
   - Linux: npx playwright install --with-deps chromium
   - macOS/Windows: npx playwright install chromium
5) Optional setup script by OS:
   - Linux: npm run setup:linux
   - macOS: npm run setup:macos
   - Windows: npm run setup:windows
6) npm run preflight
7) npm test
8) Smoke:
   - npm run unibrowse -- stop
   - npm run unibrowse -- status
   - npm run unibrowse -- goto https://example.com
   - npm run unibrowse -- snapshot
   - npm run unibrowse -- screenshot
   - npm run unibrowse -- stop
9) Print final report with command-by-command status and exact failing output if any.
```

## 3) Tool adapters

Use the same contract, then store it in the tool's project instruction channel.

### Claude Code

- Preferred location: project `CLAUDE.md`
- Add a short rule block:
  - use `npm run unibrowse -- <command>` for browser automation
  - run `npm run preflight` before triage
  - keep token values out of logs

### Codex CLI

- Store in your project instruction file (commonly `AGENTS.md` or equivalent local config used by your Codex workflow).
- Include the smoke command sequence and no-commit guardrails.

### OpenCode

- Add the same rule block in the workspace instruction file used by OpenCode.
- Ensure shell examples are copied with OS-appropriate syntax.

### IDE agents (Cursor, Windsurf, etc.)

- Put the contract in workspace rules/instructions.
- Add one reusable command palette snippet:
  - `npm run unibrowse -- status`
  - `npm run unibrowse -- goto <url>`
  - `npm run unibrowse -- snapshot`

### Gemini-based terminal wrappers

- Add the contract to startup prompt/project memory file.
- Keep invocation explicit (`npm run unibrowse -- ...`) to avoid bin resolution variance.

## 4) Acceptance checklist for "plugged" status

Mark integration complete only if all are true:

- `npm run preflight` passes required checks.
- `npm test` passes.
- `npm run unibrowse -- status` auto-starts daemon.
- `npm run unibrowse -- snapshot` returns non-empty output.
- `npm run unibrowse -- stop` exits cleanly.

## 5) Common integration failures

- `npx unibrowse` not found: use `npm run unibrowse -- <command>`.
- Linux headed without display: install Xvfb or use headless mode.
- macOS cookie decrypt blocked: keychain approval required.
- Windows cookie decrypt blocked: run under the same user profile and ensure PowerShell is available.
