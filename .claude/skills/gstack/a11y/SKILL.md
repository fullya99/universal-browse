---
name: a11y
version: 1.0.0
description: |
  WCAG 2.1 AA accessibility audit with structured report and score. Analyzes source files
  (JSX/TSX/Vue/Svelte) or a live URL for accessibility issues. Produces a scored report
  with severity levels and fix recommendations. Triggers on: "accessibility", "a11y",
  "WCAG", "screen reader", "keyboard navigation", or any accessibility-related request.
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
---

# Accessibility Audit (WCAG 2.1 AA)

You are running the `/a11y` skill. Perform a comprehensive accessibility audit against WCAG 2.1 Level AA criteria.

---

## Step 1: Determine audit mode

Two modes based on input:

**Mode A — Source code audit** (default if no URL provided):
- Scan all component files: `**/*.tsx`, `**/*.jsx`, `**/*.vue`, `**/*.svelte`
- Analyze HTML structure, ARIA usage, form patterns, interactive elements

**Mode B — Live URL audit** (if URL provided):
- Use the `browse` binary to navigate to the URL
- Inject accessibility checks via JavaScript
- Combine with source analysis for full coverage

```bash
# Find the browse binary
B="$(find .claude/skills -name browse -type f -perm +111 2>/dev/null | head -1)"
[ -z "$B" ] && B="$HOME/.claude/skills/gstack/browse/dist/browse"
```

---

## Step 2: Source code analysis

Scan all UI files for common accessibility violations:

### 2.1 Images without alt text
```bash
# Find img tags without alt attribute
grep -rn '<img' --include="*.tsx" --include="*.jsx" --include="*.vue" --include="*.svelte" | grep -v 'alt='
```

Also check:
- `<Image` components (Next.js, etc.) without `alt`
- Background images used for meaningful content (should have `role="img"` + `aria-label`)
- SVG icons without `aria-label` or `aria-hidden="true"`

### 2.2 Interactive elements without accessible names
Search for:
- `<button>` with no text content and no `aria-label`
- `<a>` with no text content (icon-only links)
- `<input>` without associated `<label>` (via `htmlFor`/`id` or wrapping)
- `<select>`, `<textarea>` without labels
- Custom interactive `<div>` or `<span>` with `onClick` but no `role` or `tabIndex`

### 2.3 Heading hierarchy
```bash
# Extract all heading tags to check hierarchy
grep -rn '<h[1-6]' --include="*.tsx" --include="*.jsx" --include="*.vue" --include="*.svelte"
```

Check for:
- Multiple `<h1>` per page/route
- Skipped heading levels (h1 → h3 without h2)
- Headings used for styling instead of semantics

### 2.4 Color contrast
- Detect hardcoded color values in inline styles
- Flag text on colored backgrounds where contrast ratio might fail
- Check for `opacity` values that could reduce contrast
- Note: full contrast check requires runtime — flag for manual verification if source-only mode

### 2.5 Form accessibility
- All inputs have associated labels (`<label htmlFor>` or `aria-label`)
- Required fields have `aria-required="true"` or `required` attribute
- Error messages are linked via `aria-describedby`
- Form groups use `<fieldset>` + `<legend>`

### 2.6 Keyboard navigation
- Interactive elements are focusable (native `<button>`, `<a>`, `<input>` or `tabIndex="0"`)
- Custom components with `onClick` also have `onKeyDown`/`onKeyUp` handlers
- No `tabIndex` values > 0 (disrupts natural tab order)
- Modal/dialog components trap focus (`focus-trap` or manual implementation)
- `Escape` key closes modals/popups

### 2.7 ARIA usage
- `aria-hidden="true"` not set on focusable elements
- `role` attributes match expected patterns (no `role="button"` on `<a>`)
- `aria-expanded`, `aria-selected`, `aria-checked` used correctly on interactive widgets
- Live regions (`aria-live`) for dynamic content updates
- No redundant ARIA (e.g., `role="button"` on `<button>`)

### 2.8 Motion and animation
- CSS animations/transitions respect `prefers-reduced-motion`
- No auto-playing animations without user control
- Check for `@media (prefers-reduced-motion: reduce)` in stylesheets

---

## Step 3: Live URL audit (Mode B only)

If a URL was provided and the browse binary is available:

```bash
$B goto <URL>
```

Then inject JavaScript checks:

```bash
# Check for images without alt
$B js "document.querySelectorAll('img:not([alt])').length"

# Check for buttons without accessible names
$B js "document.querySelectorAll('button:not([aria-label])').length"

# Check heading hierarchy
$B js "[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => h.tagName + ': ' + h.textContent.trim().substring(0, 50)).join('\\n')"

# Check for missing form labels
$B js "document.querySelectorAll('input:not([aria-label]):not([id])').length"

# Check color contrast on text elements (basic check)
$B js "(() => { const els = document.querySelectorAll('p, span, a, button, h1, h2, h3, h4, h5, h6, li, td, th, label'); let issues = 0; els.forEach(el => { const style = getComputedStyle(el); const color = style.color; const bg = style.backgroundColor; if (bg === 'rgba(0, 0, 0, 0)') return; issues++; }); return 'Elements with explicit backgrounds to verify: ' + issues; })()"

# Check for focus indicators
$B js "(() => { const style = document.createElement('style'); style.textContent = '*:focus { outline: 3px solid red !important; }'; document.head.appendChild(style); return 'Focus styles injected for visual verification'; })()"

# Take screenshot for visual review
$B screenshot a11y-check
```

---

## Step 4: Generate the report

Create the report directory and file:

```bash
mkdir -p .gstack/a11y-reports
```

### Report format

Write to `.gstack/a11y-reports/a11y-report-YYYY-MM-DD.md`:

```markdown
# Accessibility Audit Report
**Date:** YYYY-MM-DD
**Scope:** [source files / URL]
**Standard:** WCAG 2.1 Level AA

## Score: XX/100

## Summary
- Critical: N issues
- High: N issues
- Medium: N issues
- Low: N issues

## Critical Issues
### [C1] <Title>
- **Rule:** <WCAG criterion, e.g., 1.1.1 Non-text Content>
- **Location:** <file:line or URL element>
- **Problem:** <description>
- **Fix:** <specific recommendation>

## High Issues
...

## Medium Issues
...

## Low Issues
...

## Passed Checks
- [x] <check that passed>
```

### Scoring rubric

| Category | Weight | Deductions |
|----------|--------|------------|
| Images & alt text | 15 | -5 per missing alt on meaningful image |
| Interactive elements | 20 | -10 per unlabeled button/link, -5 per missing keyboard handler |
| Heading hierarchy | 10 | -5 per skipped level, -3 per duplicate h1 |
| Form accessibility | 15 | -5 per unlabeled input, -3 per missing error association |
| Color contrast | 15 | -5 per suspected low-contrast text |
| Keyboard navigation | 15 | -10 per focus trap issue, -5 per non-focusable interactive |
| ARIA correctness | 5 | -2 per misused ARIA attribute |
| Motion respect | 5 | -5 if no prefers-reduced-motion and animations present |

Start at 100, subtract deductions, floor at 0.

---

## Step 5: Output summary

Print to stdout:
- Overall score
- Count of issues by severity
- Top 3 most impactful fixes
- Path to full report

---

## Important Rules

- **Never modify files.** This is an audit-only skill. Report issues, suggest fixes, but do not change code.
- **Be specific.** Every issue must have a file:line reference and a concrete fix suggestion.
- **No false positives.** Only flag issues you're confident about. Use "Verify manually" for uncertain contrast ratios.
- **WCAG 2.1 AA is the target.** Don't flag AAA-only criteria unless they're easy wins.
- **Reference WCAG criteria.** Every issue should cite the specific WCAG success criterion it violates.
