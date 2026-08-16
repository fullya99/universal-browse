---
name: components
version: 1.0.0
description: |
  Explore and reuse design system components. Discovers components from Storybook MCP or
  static analysis, builds a searchable catalog with props/variants/examples, and suggests
  existing components to avoid duplication. Triggers on: "list components", "find component",
  "component catalog", "design system", "what components do we have", or before creating new UI.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - AskUserQuestion
---

# Component Explorer

You are running the `/components` skill. Discover, catalog, and search existing design system components.

---

## Step 1: Detect component sources

Check which discovery methods are available:

### 1.1 Storybook MCP
If `mcp__storybook__*` tools are available, use them to:
- List all stories
- Get component props, variants, and documentation
- This is the preferred source — most complete metadata

### 1.2 Static analysis (fallback)
Scan the codebase for component files:

```bash
# Find all component files
find src app lib components -name "*.tsx" -o -name "*.jsx" -o -name "*.vue" -o -name "*.svelte" 2>/dev/null | sort

# Find component directories
ls -d src/components/*/ app/components/*/ components/*/ lib/components/*/ ui/*/ 2>/dev/null
```

---

## Step 2: Build the catalog

For each discovered component, extract:

### From Storybook (if available):
- Component name
- Props interface (with types and defaults)
- Variants/stories
- Description/documentation
- Source file path

### From static analysis:
Parse each component file to extract:

```bash
# Find exported components and their Props interfaces
grep -rn "export.*function\|export.*const\|export default\|interface.*Props" --include="*.tsx" --include="*.jsx" src/components/ app/components/ components/ 2>/dev/null
```

For each component:
1. **Name** — from the export statement
2. **Props** — from the `Props` or `ComponentNameProps` interface/type
3. **File path** — where it lives
4. **Variants** — detected from union type props (e.g., `variant: "primary" | "secondary"`)
5. **Dependencies** — what it imports (other components, icons, etc.)

---

## Step 3: Handle user query

If the user asked for a specific component (e.g., "find button"), filter the catalog:

```bash
# Search by keyword in component names and content
grep -rli "button" --include="*.tsx" --include="*.jsx" src/components/ app/components/ components/ 2>/dev/null
```

If no specific query, present the full catalog organized by category:
- **Layout** — Container, Grid, Stack, Flex, Spacer
- **Navigation** — Navbar, Sidebar, Tabs, Breadcrumb, Pagination
- **Forms** — Input, Select, Checkbox, Radio, Switch, Textarea, DatePicker
- **Feedback** — Alert, Toast, Modal, Dialog, Tooltip, Popover
- **Data Display** — Table, Card, List, Badge, Avatar, Tag
- **Actions** — Button, IconButton, Link, Menu, Dropdown

---

## Step 4: Show component details

For each matched component, display:

```
### ComponentName
**Path:** src/components/ComponentName.tsx
**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | "primary" \| "secondary" \| "ghost" | "primary" | Visual style |
| size | "sm" \| "md" \| "lg" | "md" | Size variant |
| disabled | boolean | false | Disabled state |
| children | ReactNode | — | Content |

**Usage:**
\`\`\`tsx
<ComponentName variant="primary" size="md">
  Click me
</ComponentName>
\`\`\`
```

---

## Step 5: Duplication detection

If the user is about to create a new component, compare against the catalog:

1. Check for name similarity (fuzzy match)
2. Check for functional overlap (same props pattern, same purpose)
3. If potential overlap found, ask:

"I found an existing component `Button` in `src/components/Button.tsx` that might cover this use case. It supports variants: primary, secondary, ghost. Want to extend it instead of creating a new one?"

---

## Important Rules

- **Read-only.** This skill never modifies files. It only reads and reports.
- **Prefer Storybook data** over static analysis when available — it's more reliable and complete.
- **Be concise.** For large catalogs (20+ components), show a summary table first, then details on request.
- **Show real code.** Usage examples should use actual prop values from the component, not placeholders.
- **Flag inconsistencies.** If two components do similar things (e.g., `Modal` and `Dialog`), mention it.
