---
name: design-cycle
description: |
  Complete design-to-production cycle: design intake → component check → accessibility audit →
  code review → ship → QA verification. Use for implementing UI from Figma designs or design briefs.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Skill
  - AskUserQuestion
---

Execute the full design-to-production cycle. This workflow ensures beautiful, accessible, reviewed UI ships to production.

## Phase 1: Design Intake

### Step 1: Gather design input

Ask the user what they're building:

"What UI are you implementing? You can provide:
- A **Figma URL** (I'll extract the design and convert it to code)
- A **design brief** (describe the component/page and I'll generate it)
- A **screenshot** (describe what you see and I'll build it)"

### Step 2: Generate components

Based on the input:

**If Figma URL provided** — invoke `/design-to-code`:
```
skill: "design-to-code"
args: "<figma-url>"
```

**If design brief or no Figma** — invoke `/ui`:
```
skill: "ui"
```

Summarize: what was generated, which files were created, key design decisions made.

## Phase 2: Component Check

### Step 3: Check for duplicates

Before proceeding, verify we haven't reinvented existing components.

Invoke `/components`:
```
skill: "components"
```

If overlap is detected, ask the user:

"The generated `Card` component overlaps with the existing `ContentCard` in `src/components/ContentCard.tsx`. Should I:
A) Merge the new design into the existing component
B) Keep both (the new one serves a different purpose)
C) Replace the old component with the new one"

Apply the user's choice before proceeding.

## Phase 3: Accessibility Audit

### Step 4: Run accessibility checks

Invoke `/a11y` to audit the newly created/modified components:
```
skill: "a11y"
```

**CRITICAL GATE:** If `/a11y` reports Critical issues:
- Display the critical issues clearly
- Ask the user: "There are critical accessibility issues. Fix them before proceeding? (Recommended)"
- If yes, fix the issues (apply the recommendations from the a11y report)
- Re-run `/a11y` to verify fixes
- If the user wants to proceed anyway, note it in the final report

Summarize: a11y score, issues found, fixes applied.

## Phase 4: Code Review

### Step 5: Pre-landing review

Invoke `/review` to check the diff:
```
skill: "review"
```

**CRITICAL GATE:** If `/review` finds Critical issues, do NOT proceed to ship. Ask the user to fix them first.

Summarize: review findings, actions taken.

## Phase 5: Ship

### Step 6: Ship it

Only proceed if review passed without critical issues.

Invoke `/ship`:
```
skill: "ship"
```

Summarize: PR URL, version bump, changelog entry.

## Phase 6: QA Verification

### Step 7: Verify deployment

Ask the user for the staging/preview URL:

"PR created! Provide the staging URL to run QA verification, or say 'skip' to finish."

If URL provided, invoke `/qa`:
```
skill: "qa"
args: "<staging-url>"
```

## Final Report

Provide a complete cycle summary:

```
Design Cycle Report
====================
Design source:    [Figma URL / brief description]
Components:       [list of created/modified components]
A11y score:       [X/100]
A11y issues:      [N critical, N high, N medium, N low]
Review findings:  [summary]
PR URL:           [url]
Version:          [X.Y.Z]
QA health:        [score if run]
Status:           COMPLETE | NEEDS ATTENTION | BLOCKED
```

If any phase was skipped or had issues, note it clearly with the reason.
