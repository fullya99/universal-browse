# PLAN: Drastically Increase universal-browse Execution Speed

## Context

On Windows + Claude Code, simple browser tasks (form fills with predefined values) take 1m30-2min. Root cause: multiple compounding bottlenecks. The ecosystem has evolved (Playwright CLI 4x faster, Stagehand v3 CDP-native 44% faster) — we must catch up.

**Constraint: ALL changes MUST work on Linux, macOS, AND Windows.** CI validates all 3 platforms.

---

## Research Summary

### Current Bottlenecks (codebase analysis)

| Bottleneck | Impact | Location |
|-----------|--------|----------|
| **Each action = separate CLI invocation + HTTP round-trip** | 10-30s for 10-field form | `src/cli.js:128-146`, SKILL.md patterns |
| **Default 30s Playwright timeouts on fill/click** | 10-50s if selectors slow | `src/browser-manager.js:565-577` |
| **Challenge detection runs on every `goto`** | 2-5s overhead per nav | `src/browser-manager.js:250-434` |
| **No OS-specific browser launch flags** | 3-5s slower startup (Windows) | `src/display-strategy.js:18-57` |
| **2.2s hardcoded wait in challenge solver** | Always burned if detected | `src/browser-manager.js:416` |

### Ecosystem Intelligence

| Tool | Key Insight | URL |
|------|-------------|-----|
| Playwright CLI (@playwright/cli) | 4x fewer tokens than MCP, disk-based snapshots, Microsoft recommends for coding agents | https://testcollab.com/blog/playwright-cli |
| Stagehand v3 | CDP-native = 44% faster, removed Playwright dep, `agent()` for multi-step | https://www.browserbase.com/blog/stagehand-v3 |
| Chrome DevTools MCP | Direct CDP control, lower overhead | https://github.com/ChromeDevTools/chrome-devtools-mcp |
| Browser MCP | Chrome extension + MCP, local execution | https://browsermcp.io/ |
| Quick Mode (Claude Chrome) | Bypasses tool-use protocol = 3x faster | Community reports |
| Action batching | Multiple actions in single call eliminates round-trip overhead | Universal pattern |

---

## Implementation Plan (6 Phases)

### Phase 1: Batch Command API (HIGHEST IMPACT - ~60-70% speedup)

**Goal:** Execute N browser actions in 1 HTTP round-trip instead of N round-trips.

**Files to modify:**
- `src/browser-manager.js` — Add `batch` command handler
- `src/cli.js` — Add `batch` subcommand (parse multiple quoted commands from args)
- `skill/universal-browse/SKILL.md` — Document batch usage

**Design:**
```bash
# Current: 5 separate invocations (slow)
npm run unibrowse -- fill "#email" "user@test.com"
npm run unibrowse -- fill "#password" "pass123"
npm run unibrowse -- click "#submit"

# New: 1 invocation (fast)
npm run unibrowse -- batch \
  'fill #email user@test.com' \
  'fill #password pass123' \
  'click #submit'
```

**Server-side:** `POST /command` with `{ "command": "batch", "args": [...] }`. Each element in args is a string `"command arg1 arg2"`. Execute sequentially in same browser context, collect results array. On error in any sub-command: stop and return partial results + error.

**Multi-OS:** Pure Node.js, no OS-specific code needed. CLI argument parsing must handle both single-quote (Linux/macOS) and double-quote (Windows/PowerShell) patterns.

**Windows CLI note:** PowerShell doesn't support single-quoted args the same way. Support JSON array input as alternative:
```powershell
npm run unibrowse -- batch --json '[\"fill #email user@test.com\",\"fill #password pass123\"]'
```

### Phase 2: `execute` Command — JS Evaluation (BIGGEST SPEEDUP for simple cases ~90%+)

**Goal:** Run arbitrary JavaScript in page context. Single round-trip, direct DOM manipulation.

**Files to modify:**
- `src/browser-manager.js` — Add `execute` command handler

**Design:**
```bash
npm run unibrowse -- execute "document.querySelector('#email').value='test@test.com'; document.querySelector('#password').value='pass'; document.querySelector('#submit').click()"
```

**Implementation:**
```javascript
case "execute": {
  const script = args.join(" ");
  if (!script) throw new Error("Usage: execute <javascript>");
  const result = await this.page.evaluate(script);
  return `OK: ${JSON.stringify(result)}`;
}
```

**Security:** Same trust boundary as existing commands (daemon is localhost-only, token-protected). Document that this runs in page context, not Node context.

**Multi-OS:** Pure JS evaluation via Playwright — identical behavior on all platforms.

### Phase 3: Reduce Timeouts & Add Fast Defaults

**Files to modify:**
- `src/browser-manager.js` — Set default timeout, add pre-validation

**Changes:**
1. After browser context creation: `this.page.setDefaultTimeout(10000)` (10s instead of 30s)
2. For `fill` and `click`: add `waitFor({ state: 'visible', timeout: 5000 })` before action — fail fast
3. Add optional `--timeout <ms>` flag to `fill`, `click`, `goto` for per-command override

**Multi-OS:** Playwright timeout behavior is identical across platforms.

### Phase 4: OS-Specific Browser Launch Optimizations

**Files to modify:**
- `src/display-strategy.js` — Add platform-specific Chromium args

**Changes:**
```javascript
// Common fast-launch args (all platforms)
args.push('--no-first-run', '--disable-extensions', '--disable-background-networking',
          '--disable-default-apps', '--disable-sync', '--disable-translate');

// Windows-specific
if (process.platform === 'win32') {
  args.push('--disable-gpu');  // GPU compositing slower on some Windows setups
}

// Linux without display (headless VPS)
if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
  args.push('--disable-gpu', '--disable-software-rasterizer');
}
```

**macOS:** No additional flags needed — Chromium performs well natively.

### Phase 5: Optimize Challenge Detection

**Files to modify:**
- `src/browser-manager.js` — Make challenge detection smarter

**Changes:**
1. Add `--no-challenge` flag to `goto` command to skip detection entirely
2. By default: only run `inspectChallenge()` if URL changed after navigation (redirect detected)
3. Reduce hardcoded `2200ms` challenge wait to `1200ms`
4. In `batch` mode: only run challenge detection on the first `goto`, skip for subsequent actions

**Multi-OS:** Challenge detection is pure JS — same on all platforms.

### Phase 6: SKILL.md & Documentation Update

**Files to modify:**
- `skill/universal-browse/SKILL.md` — Batch/execute examples as primary patterns
- `skill/universal-browse/references/troubleshooting.md` — Speed optimization section
- `README.md` — New commands documented

**Changes:**
- Default form-fill examples use `batch` command
- Add "Speed Tips" section:
  - Use `execute` for simple DOM manipulation (fastest)
  - Use `batch` for mixed actions (fast)
  - Use individual commands only for single operations
- Document Windows PowerShell `--json` syntax for batch
- Document `--no-challenge` flag

---

## Tests to Add

| Test | File | What it validates |
|------|------|-------------------|
| `batch` executes multiple commands | `test/browser-manager.test.js` | Returns array of results, stops on error |
| `batch` with empty array | `test/browser-manager.test.js` | Returns empty array |
| `execute` returns evaluated result | `test/browser-manager.test.js` | JS eval works |
| `execute` with empty script | `test/browser-manager.test.js` | Throws usage error |
| CLI `batch` argument parsing | `test/cli.test.js` | Handles quoted strings, --json mode |
| Reduced timeout behavior | `test/browser-manager.test.js` | Fails in <10s not 30s |

---

## Verification Checklist

- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] `npm run test:coverage` passes
- [ ] `npm run preflight` passes
- [ ] Smoke: `status -> goto -> snapshot -> stop` works
- [ ] Smoke: `batch 'fill input test' 'click button'` works
- [ ] Smoke: `execute "document.title"` returns page title
- [ ] Batch with 5+ actions = single HTTP round-trip confirmed
- [ ] Windows: PowerShell `--json` batch syntax works
- [ ] Linux: Standard batch syntax works
- [ ] macOS: Standard batch syntax works
- [ ] CI green on all 3 OS (`.github/workflows/ci.yml`)

## Files Modified (Complete List)

| File | Changes |
|------|---------|
| `src/browser-manager.js` | `batch` handler, `execute` handler, reduced timeouts (10s), challenge detection opt-out, fast waitFor on fill/click |
| `src/cli.js` | `batch` subcommand parsing (quoted args + `--json` mode) |
| `src/display-strategy.js` | Platform-specific Chromium launch flags (Windows, Linux, macOS) |
| `skill/universal-browse/SKILL.md` | Batch/execute examples, speed tips section |
| `skill/universal-browse/references/troubleshooting.md` | Speed optimization section |
| `README.md` | New commands (batch, execute), flags (--no-challenge, --timeout) |
| `test/browser-manager.test.js` | Tests for batch, execute, timeout behavior |
| `test/cli.test.js` | Tests for batch CLI argument parsing |

---

## Expected Impact

| Scenario | Before | After (estimated) |
|----------|--------|-------------------|
| Fill 10-field form (Windows) | 90-120s | 15-25s |
| Fill 10-field form (macOS/Linux) | 30-60s | 5-10s |
| Simple login (email+pass+click) | 30-45s | 3-5s (with `execute`) |
| Navigation to known-safe URL | 5-8s | 2-3s (with `--no-challenge`) |

---

## Copy-Paste Implementation Prompt

After `/clear`, paste this:

```
Implement the speed optimization plan from PLAN-speed-optimization.md at the project root.

Read the plan first, then implement ALL 6 phases in order:
1. Batch command API (browser-manager.js + cli.js)
2. Execute command (browser-manager.js)  
3. Reduced timeouts (browser-manager.js)
4. OS-specific browser launch flags (display-strategy.js)
5. Challenge detection optimization (browser-manager.js)
6. SKILL.md + troubleshooting + README updates

Constraints:
- ALL changes must work on Linux, macOS, AND Windows
- Windows PowerShell: batch command must support --json mode for arrays
- Follow existing code style and patterns
- Add tests for batch, execute, and timeout behavior
- Run npm test + npm run lint after implementation
- Follow CLAUDE.md definition of done
```
