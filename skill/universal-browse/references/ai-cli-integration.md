# AI CLI and IDE Integration (Turnkey)

This document gives a single integration contract so `universal-browse` can be plugged into most AI terminal tools and IDE agents with minimal manual work.

## 0) Research-backed assumptions (web scan)

Integration strategy below is based on public docs/repositories:

- Claude Code docs: project memory via `CLAUDE.md`, plus native skills ecosystem.
- Codex docs: explicit `AGENTS.md` guide in Codex docs.
- OpenCode docs: `/init` creates `AGENTS.md` in project root.
- Gemini CLI repo/docs: explicit project context file `GEMINI.md`.
- Kimi Code CLI docs: `/init` generates project `AGENTS.md` and is the native project instruction path.

## 1) Integration contract (native-first)

Every tool-specific setup should enforce these rules:

- Use `npm run unibrowse -- <command>` as the default runtime command.
- Run `npm run preflight` before debugging runtime failures.
- Never print or store raw daemon bearer tokens.
- Never print or store raw cookie values in reports/logs.
- Keep daemon local-only (`127.0.0.1`).
- Do not commit/push automatically during setup.
- Do not report success unless native registration/proof is complete for the host tool.

This contract is cross-CLI/cross-AI: Claude Code, Codex CLI, OpenCode, Gemini CLI, Kimi Code CLI, and IDE agents must use the same runtime and security guardrails.

## 2) Success criteria (must pass both)

- `READY-RUNTIME`: install + tests + smoke commands pass.
- `READY-NATIVE-SKILL`: tool-native registration/instruction discovery is proven with evidence commands.

If native proof is missing, final status must be `READY-RUNTIME-ONLY` (not fully plugged).

## 3) Universal bootstrap prompt (for any AI CLI)

Copy/paste this first prompt in the user's AI CLI. It forces an interactive choice flow before any setup.

```text
You are configuring universal-browse as a reusable skill/workflow for this project.

Repository root: universal-browse
Source of truth: skill/universal-browse/references/ai-cli-integration.md

Objectives:
1) install + validate universal-browse
2) detect this AI tool and install in the native skill/instruction location
3) collect proof that native registration is active

Before setup, ask the user these choices and wait for answers:
1) Target tool: Claude Code / Codex CLI / OpenCode / Gemini CLI / Kimi Code CLI / other
2) Install scope: project-native / personal-native / runtime-only fallback
3) If native registration fails: stop with NOT READY or continue as READY-RUNTIME-ONLY

Rules:
- no commit/push
- no destructive git commands
- no source code edits (docs/instruction files only)
- show each command before running it

Execution plan:
1) Collect user choices above.
2) Follow section "4) Native target matrix" and perform native registration for the selected tool/scope.
3) Run install + validation from section "5) Install and validate runtime".
4) Write/update instruction content from section "6) Instruction block template".
5) Run both checklists from sections "7" and "8".
6) Print final report with READY-RUNTIME and READY-NATIVE-SKILL separately.
```

## 3.1) Interactive decision mapping

Apply these defaults unless the user chooses otherwise:

- Claude Code: prefer standalone native skill install first (`.claude/skills/...`) for deterministic setup.
- Codex CLI: prefer project `AGENTS.md`; use `~/.codex/AGENTS.md` only if user asks global scope.
- OpenCode: prefer project `AGENTS.md` via `/init`.
- Gemini CLI: prefer project `GEMINI.md`.
- Kimi Code CLI: prefer project `AGENTS.md` via `/init`.

If user chooses runtime-only fallback, still run section 5 and report `READY-RUNTIME-ONLY`.

## 4) Native target matrix

Use the first exact match. Do not downgrade to generic files if a native location exists.

- Claude Code
  - native skill location: `.claude/skills/universal-browse/SKILL.md` (project) or `~/.claude/skills/universal-browse/SKILL.md` (personal)
  - native standalone installer: `npm run install:claude:project` or `npm run install:claude:personal`
  - proof command: ask Claude for available skills and verify `/universal-browse` exists
- Codex CLI
  - native instructions: `AGENTS.md` (or `AGENTS.override.md`) per Codex discovery
  - proof command: `codex --ask-for-approval never "Summarize active instruction files"`
- OpenCode
  - native instructions: `AGENTS.md` (OpenCode `/init` standard)
  - proof command: run `/init` (if needed), then ask OpenCode to report loaded project instructions
- Gemini CLI
  - native instructions: `GEMINI.md`
  - proof command: ask Gemini to summarize active project instructions and mention `GEMINI.md`
- Kimi Code CLI
  - native instructions: `AGENTS.md` generated/managed via `/init`
  - proof command: run `/init` if file missing, then ask Kimi to summarize active project instructions
- IDE agents (Cursor, Windsurf, JetBrains plugins, etc.)
  - use workspace instruction/rules file if available
  - otherwise use `AGENTS.md` and mark status as runtime-only for that IDE until native proof exists

## 5) Install and validate runtime

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

## 6) Instruction block template

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

## 7) Acceptance checklist (runtime)

Mark runtime ready only if all are true:

- `npm run preflight` passes required checks.
- `npm test` passes.
- `npm run unibrowse -- status` auto-starts daemon.
- `npm run unibrowse -- snapshot` returns non-empty output.
- `npm run unibrowse -- stop` exits cleanly.

## 8) Acceptance checklist (native registration)

Mark native-ready only if all are true:

- Native target from section 4 is installed/configured (not fallback only).
- Instruction/skill content from section 6 is present in native location.
- Proof command output is captured and references the native location or active skill.
- User can invoke native entrypoint:
  - Claude: `/universal-browse`
  - Codex/OpenCode/Kimi: active `AGENTS.md` behavior visible
  - Gemini: active `GEMINI.md` behavior visible

## 9) Tool adapters (notes)

Use the same contract, then store it in the tool's project instruction channel.

### Claude Code

- Prefer `.claude/skills/universal-browse/SKILL.md` for deterministic native setup.
- `CLAUDE.md` is supporting memory, not a native skill install by itself.
- Standalone native install (recommended):

```bash
npm run install:claude:project
# or
npm run install:claude:personal
```

This copies the full skill directory (SKILL.md + references/) to the target scope.
Verify with: `ls ~/.claude/skills/universal-browse/references/`

- Plugin workflow is not supported for installation in this repository. Use standalone native installers only.

### Codex CLI

- Store in `AGENTS.md` / `AGENTS.override.md` and verify discovery via Codex command output.
- Include the smoke command sequence and no-commit guardrails.

### OpenCode

- Use `AGENTS.md` as the primary project instruction file.
- Ensure shell examples are copied with OS-appropriate syntax.

### IDE agents (Cursor, Windsurf, etc.)

- Put the contract in workspace rules/instructions.
- Add one reusable command palette snippet:
  - `npm run unibrowse -- status`
  - `npm run unibrowse -- goto <url>`
  - `npm run unibrowse -- snapshot`

### Gemini CLI

- Use `GEMINI.md` as native project instructions file.
- Keep invocation explicit (`npm run unibrowse -- ...`) to avoid bin resolution variance.

### Gemini-based wrappers

- Add the contract to startup prompt/project memory file.
- Keep invocation explicit (`npm run unibrowse -- ...`) to avoid bin resolution variance.

### Kimi Code CLI

- Use `/init` to generate project `AGENTS.md` if missing, then append the instruction block.
- Do not mark native-ready until Kimi confirms active project instructions.

## 10) Common integration failures

- `npx unibrowse` not found: use `npm run unibrowse -- <command>`.
- runtime PASS but native not installed: mark `READY-RUNTIME-ONLY`, not full success.
- Claude skill not detected after install: rerun `npm run install:claude:project` or `npm run install:claude:personal`, then verify `.claude/skills/universal-browse/SKILL.md` exists in the selected scope.
- Linux headed without display: install Xvfb or use headless mode.
- macOS cookie decrypt blocked: keychain approval required.
- Windows cookie decrypt blocked: run under the same user profile and ensure PowerShell is available.
- Google login blocked in automation browser: if Google shows "This browser or app may not be secure", use cookie handoff (`cookie-import`) from a trusted regular browser session instead of in-automation sign-in.
