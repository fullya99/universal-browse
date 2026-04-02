# AI CLI and IDE Integration (Turnkey)

This document gives a single integration contract so `universal-browse` can be plugged into most AI terminal tools and IDE agents with minimal manual work.

## 0) Research-backed assumptions (web scan)

Integration strategy below is based on public docs/repositories:

- Claude Code docs: project memory via `CLAUDE.md`, plus skills/plugins ecosystem.
- Codex docs: explicit `AGENTS.md` guide in Codex docs.
- OpenCode docs: `/init` creates `AGENTS.md` in project root.
- Gemini CLI repo/docs: explicit project context file `GEMINI.md`.
- Kimi ecosystem: model/platform docs are public, but no single official terminal-agent config standard was identified in the same way as `CLAUDE.md` / `AGENTS.md` / `GEMINI.md`; use generic adapter flow for Kimi-based CLIs.

## 1) Integration contract

Every tool-specific setup should enforce these rules:

- Use `npm run unibrowse -- <command>` as the default runtime command.
- Run `npm run preflight` before debugging runtime failures.
- Never print or store raw daemon bearer tokens.
- Keep daemon local-only (`127.0.0.1`).
- Do not commit/push automatically during setup.

## 2) Universal bootstrap prompt (for any AI CLI)

Copy/paste this first prompt in the user's AI CLI. It asks the agent to detect the host tool and wire the right instruction file automatically.

```text
You are configuring universal-browse as a reusable skill/workflow for this project.

Repository root: universal-browse
Source of truth: skill/universal-browse/references/ai-cli-integration.md

Objectives:
1) install + validate universal-browse
2) detect this AI tool and write the right project instruction file
3) register command conventions so future sessions can call unibrowse reliably

Rules:
- no commit/push
- no destructive git commands
- no source code edits (docs/instruction files only)
- show each command before running it

Execution plan:
1) Detect host tool (Claude Code / Codex CLI / OpenCode / Gemini CLI / Kimi-based CLI / IDE agent).
2) Follow section "3) Adapter matrix" in ai-cli-integration.md to pick instruction target files.
3) Run install + validation from section "4) Install and validate runtime".
4) Write/update tool instruction file with section "5) Instruction block template".
5) Run acceptance checklist from section "6) Acceptance checklist for plugged status".
6) Print final report: PASS/FAIL, files written, command results, next actions.
```

## 3) Adapter matrix (where instructions live)

Write the instruction block in the first matching location.

- Claude Code
  - primary: `CLAUDE.md`
  - optional plugin registration: `claude plugin add <repo-path-or-url>`
- Codex CLI
  - primary: `AGENTS.md` (Codex supports this explicitly)
- OpenCode
  - primary: `AGENTS.md` (OpenCode `/init` standard)
- Gemini CLI
  - primary: `GEMINI.md`
- Kimi-based CLI (or unknown agent wrappers)
  - primary fallback: `AI_INSTRUCTIONS.md`
  - secondary fallback: `AGENTS.md`
- IDE agents (Cursor, Windsurf, JetBrains plugins, etc.)
  - use workspace instruction/rules file if available
  - otherwise use `AI_INSTRUCTIONS.md`

## 4) Install and validate runtime

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

## 5) Instruction block template

Paste this block into the chosen instruction file:

```md
# universal-browse integration

- Default browser command: `npm run unibrowse -- <command>`
- Always run `npm run preflight` before runtime troubleshooting.
- Never expose daemon bearer tokens in logs or reports.
- Use local-only daemon behavior (`127.0.0.1`) and do not open remote control paths.

## Smoke commands

1. `npm run unibrowse -- status`
2. `npm run unibrowse -- goto https://example.com`
3. `npm run unibrowse -- snapshot`
4. `npm run unibrowse -- screenshot`
5. `npm run unibrowse -- stop`
```

## 6) Acceptance checklist for plugged status

Mark integration complete only if all are true:

- `npm run preflight` passes required checks.
- `npm test` passes.
- `npm run unibrowse -- status` auto-starts daemon.
- `npm run unibrowse -- snapshot` returns non-empty output.
- `npm run unibrowse -- stop` exits cleanly.
- At least one instruction file is written/updated (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, or `AI_INSTRUCTIONS.md`).

## 7) Tool adapters (notes)

Use the same contract, then store it in the tool's project instruction channel.

### Claude Code

- Preferred location: project `CLAUDE.md`
- Add a short rule block:
  - use `npm run unibrowse -- <command>` for browser automation
  - run `npm run preflight` before triage
  - keep token values out of logs
- Optional plugin registration (recommended for turnkey skill discovery):

```bash
claude plugin add /path/to/universal-browse
# or
claude plugin add https://github.com/fullya99/universal-browse
```

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

### Gemini CLI and Gemini-based wrappers

- Add the contract to startup prompt/project memory file.
- Keep invocation explicit (`npm run unibrowse -- ...`) to avoid bin resolution variance.

### Kimi-based CLIs

- If your Kimi CLI exposes a native project-memory file, use it.
- Otherwise default to `AI_INSTRUCTIONS.md` (or `AGENTS.md`) with the instruction template from section 5.

## 8) Common integration failures

- `npx unibrowse` not found: use `npm run unibrowse -- <command>`.
- Linux headed without display: install Xvfb or use headless mode.
- macOS cookie decrypt blocked: keychain approval required.
- Windows cookie decrypt blocked: run under the same user profile and ensure PowerShell is available.
