---
name: ui
version: 2.0.0
description: |
  Generate beautiful UI components with AI-powered design tools. Uses Google Stitch
  for AI-generated UI designs (text-to-UI, image-to-UI, vibe design), 21st.dev Magic MCP
  for component inspiration, and Figma MCP for design-to-code conversion. Adapts everything
  to the project's framework and styling conventions.
  Triggers on: "create component", "ui component", "build a button/modal/card",
  "generate UI", "stitch", "vibe design", or any request to create visual interface elements.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
---

# UI Component Generator v2 — Stitch + Magic MCP + Figma

You are running the `/ui` skill. Generate beautiful, production-ready UI components using Google Stitch AI design generation, 21st.dev Magic MCP component library, and project conventions.

---

## Tool availability matrix

Before starting, detect which MCP tools are available:

| Source | MCP prefix | Capability |
|--------|-----------|------------|
| **Google Stitch** | `mcp__stitch__*` | AI design generation (text-to-UI, image-to-UI, vibe design, prototyping, code export, DESIGN.md) |
| **21st.dev Magic** | `mcp__magic-ui__*` | Component inspiration library, production-ready patterns |
| **Figma** | `mcp__figma__*` | Read existing Figma designs, extract design tokens |

Proceed with whatever tools are available. Stitch is the **primary** design generation engine. Magic MCP and Figma are complementary sources.

---

## Step 1: Detect project framework and conventions

Scan the project to understand the tech stack:

```bash
# Framework detection
cat package.json 2>/dev/null | grep -E '"react"|"vue"|"svelte"|"next"|"nuxt"|"astro"|"solid"'

# Styling approach
ls tailwind.config.* 2>/dev/null
ls postcss.config.* 2>/dev/null
cat package.json 2>/dev/null | grep -E '"tailwindcss"|"styled-components"|"@emotion"|"css-modules"|"sass"'

# Component directory conventions
ls -d src/components/ app/components/ components/ lib/components/ 2>/dev/null

# Check for existing DESIGN.md (Stitch design system file)
ls DESIGN.md design/DESIGN.md 2>/dev/null
```

Determine:
- **Framework**: React, Vue, Svelte, Solid, etc.
- **Styling**: Tailwind, CSS Modules, styled-components, Emotion, vanilla CSS
- **Component dir**: where components live
- **Naming**: PascalCase files? kebab-case dirs? barrel exports (index.ts)?
- **TypeScript**: check for tsconfig.json
- **Existing design system**: DESIGN.md, design tokens, CSS custom properties

---

## Step 2: Understand the request and choose the generation path

Classify the user's request into one of these paths:

| Input type | Generation path | Primary tool |
|-----------|----------------|-------------|
| Text description ("build a dashboard") | **Stitch Text-to-UI** | `mcp__stitch__*` |
| Image/screenshot/sketch upload | **Stitch Image-to-UI** | `mcp__stitch__*` |
| Aesthetic description ("dark minimal with neon accents") | **Stitch Vibe Design** | `mcp__stitch__*` |
| Figma URL or node-id | **Figma-to-Code** | `mcp__figma__*` |
| Component name ("button", "modal", "card") | **Magic MCP + Stitch hybrid** | Both |
| Vague or missing | Ask with `AskUserQuestion` | — |

If the request is vague, ask:

"What component or UI do you need? You can:
- **Describe it** in natural language (e.g., 'a pricing page with 3 tiers')
- **Upload a screenshot/sketch** for Stitch to convert
- **Describe a vibe** (e.g., 'brutalist dark mode with sharp corners')
- **Share a Figma URL** for pixel-accurate conversion
- **Name a component** (e.g., 'command palette', 'data table')"

---

## Step 3: Check existing components

Before creating anything new, search for similar existing components:

```bash
# Search for components with similar names
find src/components lib/components app/components components -name "*.tsx" -o -name "*.vue" -o -name "*.svelte" 2>/dev/null | head -20
```

Use Grep to search for components that might already do what's needed. If overlap is found, ask the user whether to extend the existing component or create a new one.

---

## Step 4: Generate with Stitch (primary design engine)

If `mcp__stitch__*` tools are available, use Stitch as the primary design generation engine.

### 4a: Text-to-UI generation

For text-based requests, use Stitch to generate UI designs:

1. **Create or select a Stitch project** — use `list_projects` to find existing ones, or create a new one matching the project name
2. **Generate the design** — send the user's prompt to Stitch with context:
   - Include the project's framework (React, Vue, etc.)
   - Include styling approach (Tailwind, CSS Modules)
   - Include any design constraints from the user
   - Use **Experimental Mode** (Gemini 2.5 Pro) for complex layouts, **Standard Mode** for simple components
3. **Iterate conversationally** — refine the design with follow-up prompts if needed:
   - "Make the sidebar narrower"
   - "Add hover states to the cards"
   - "Switch to a 2-column layout on mobile"

### 4b: Image/Sketch-to-UI generation

For image uploads (screenshots, wireframes, napkin sketches):

1. Upload the image to Stitch
2. Stitch converts it to a polished digital design
3. Review and refine conversationally

### 4c: Vibe Design

For aesthetic-driven requests:

1. Send the vibe description to Stitch (e.g., "glassmorphism dashboard with purple gradients")
2. Stitch generates multiple divergent design directions
3. Ask the user to pick a direction, then refine

### 4d: Extract design system (DESIGN.md)

If the project doesn't have a DESIGN.md yet, use Stitch to generate one:

1. **From an existing URL**: point Stitch at the project's live URL to extract colors, typography, spacing, component patterns
2. **From generated designs**: after generating a UI, extract the design system as DESIGN.md
3. Save the DESIGN.md at the project root — it becomes the source of truth for future `/ui` and `/design-to-code` invocations

DESIGN.md format (Stitch native):
```markdown
# Design System

## Colors
- Primary: #3B82F6
- Secondary: #10B981
...

## Typography
- Headings: Inter, 600-700 weight
- Body: Inter, 400 weight, 16px/1.5
...

## Spacing
- Base unit: 4px
- Section padding: 24px / 32px / 48px
...

## Component Patterns
- Cards: rounded-xl, shadow-sm, p-6
- Buttons: rounded-lg, font-medium, px-4 py-2
...
```

### 4e: Export production code from Stitch

After design approval:

1. **Pull HTML/CSS code** from Stitch — clean, production-grade output
2. **Adapt to project conventions** — this is critical:
   - Convert HTML to JSX/Vue/Svelte syntax
   - Replace inline styles with Tailwind classes (or CSS Modules, etc.)
   - Extract repeated patterns into reusable components
   - Add TypeScript types for props
   - Add ARIA attributes and keyboard navigation
3. **Export Figma file** (optional) — if the team uses Figma, export with Auto Layout intact for handoff

### 4f: Interactive prototyping

For multi-screen features:

1. Generate individual screens with Stitch
2. Use Stitch's prototyping to connect screens into clickable flows
3. Preview the flow to validate UX before writing code
4. Once approved, export each screen's code

---

## Step 5: Enrich with Magic MCP (component patterns)

If `mcp__magic-ui__*` tools are available, use them to complement Stitch:

1. **Search for component patterns** in the 21st.dev library matching the user's request
2. **Get implementation references** — animation patterns, interaction patterns, best practices
3. **Cross-reference with Stitch output** — combine Stitch's visual design with Magic MCP's proven component patterns
4. Use `mcp__magic-ui__21st_magic_component_builder` to generate refined components
5. Use `mcp__magic-ui__21st_magic_component_refiner` to polish the final output

Adapt all found patterns to match the project's conventions — never copy blindly.

---

## Step 6: Write the component

Write the component file(s) following project conventions, combining Stitch's design output with production code standards:

1. **Main component file** — in the detected component directory, using project naming conventions
2. **Styles** — Tailwind classes inline, or separate CSS Module/styled-components as appropriate
3. **Types** — TypeScript interface for props if the project uses TS
4. **Barrel export** — update index.ts if the project uses barrel exports
5. **Design tokens** — reference DESIGN.md values if the project has one

### Component quality checklist:
- Semantic HTML elements (`button` not `div` for clickable, `nav` for navigation, etc.)
- ARIA attributes on interactive elements (`aria-label`, `role`, `aria-expanded`, etc.)
- Keyboard navigation support (`onKeyDown` handlers, `tabIndex` where needed)
- Responsive by default (use relative units, flex/grid)
- Support for `className` prop pass-through (React) or equivalent
- `forwardRef` if the component wraps a native element (React)
- Default variants via props (size, variant, disabled)
- Design fidelity — match Stitch output colors, spacing, typography exactly

---

## Step 7: Add basic tests

If the project has a test framework configured (jest, vitest, testing-library), generate a minimal test:
- Component renders without crashing
- Key elements are present in the DOM
- Interactive states work (click, hover if testable)
- Variants render correctly

Only generate tests if the project already has a test setup. Do not add test dependencies.

---

## Step 8: Summary

Output:
- **Generation path used** (Stitch text-to-UI / image-to-UI / vibe / Figma / Magic MCP hybrid)
- **Files created/modified**
- **Component API** (props interface)
- **Usage example**
- **DESIGN.md** — created or updated? (flag if the project should adopt one)
- **Stitch project link** — if a Stitch project was created, share the link for future iterations
- **Any manual steps needed** (install deps, add to design system, etc.)

---

## Advanced workflows

### Multi-screen feature generation
1. Use Stitch to generate all screens (dashboard, detail view, settings, etc.)
2. Connect screens in Stitch's prototyping mode
3. Preview and validate the flow
4. Export each screen's code
5. Wire up routing in the project (Next.js pages, Vue Router, etc.)

### Design system bootstrap
1. Point Stitch at the project's live URL or an inspiration URL
2. Extract DESIGN.md with all tokens
3. Generate a component library based on the design system
4. Use Magic MCP to find production-ready implementations of each pattern

### Redesign existing UI
1. Take a screenshot of the current UI
2. Upload to Stitch as image-to-UI input
3. Ask Stitch to "modernize" or apply a new vibe
4. Export the redesigned code
5. Diff and apply changes to the existing components

### Batch component generation
1. Define the component list (button, input, card, modal, toast, etc.)
2. Generate each in Stitch with consistent design system
3. Extract DESIGN.md once from the first component
4. Apply DESIGN.md tokens to all subsequent components
5. Use multi-screen batch edits in Stitch for consistency

---

## Important Rules

- **Match project conventions exactly.** If the project uses Tailwind, don't generate CSS Modules. If it uses kebab-case filenames, don't create PascalCase files.
- **Semantic HTML first.** Always use the correct HTML element before adding ARIA attributes.
- **Never install dependencies** without asking. If a component needs a new dep, inform the user.
- **Keep it simple.** Generate the minimum viable component. The user can iterate.
- **Accessibility from the start.** Every interactive element must be keyboard-navigable and screen-reader friendly.
- **Stitch is the design source of truth.** When Stitch generates a design, respect its visual output. Adapt the code, not the design.
- **DESIGN.md is portable.** If Stitch generates a DESIGN.md, save it in the project — it bridges design and code for all AI tools.
- **Never hardcode Stitch API keys** in project files. The MCP server handles auth.
