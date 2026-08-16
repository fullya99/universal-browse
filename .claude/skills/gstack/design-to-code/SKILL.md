---
name: design-to-code
version: 1.0.0
description: |
  Convert Figma designs to production-ready components. Accepts a Figma URL or node-id,
  reads the design hierarchy via Figma MCP, and generates pixel-accurate components with
  proper CSS, responsive behavior, and accessibility. Triggers on: "Figma to code",
  "convert design", "implement this design", "from Figma", or any Figma URL shared.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
---

# Design to Code

You are running the `/design-to-code` skill. Convert Figma designs into production-ready, accessible components.

---

## Step 1: Get the Figma reference

If the user provided a Figma URL or node-id, proceed. Otherwise, ask:

"Share the Figma URL or node-id for the frame you want to convert. You can also paste a Figma link like `https://www.figma.com/file/ABC123/...?node-id=1:2`"

Parse the URL to extract file key and node-id if present.

---

## Step 2: Read the Figma design

Use `mcp__figma__*` tools to read the design hierarchy:

1. **Get file/node data** — layout structure, component hierarchy
2. **Extract design tokens:**
   - Colors (fills, strokes) → CSS custom properties or Tailwind colors
   - Typography (font family, size, weight, line height, letter spacing)
   - Spacing (padding, margins, gaps from auto-layout)
   - Border radius, shadows, effects
3. **Understand layout:**
   - Auto-layout direction → flexbox direction
   - Auto-layout spacing → gap
   - Auto-layout padding → padding
   - Constraints → responsive behavior
   - Min/max width/height
4. **Identify variants** — component sets with different states/sizes

Record all extracted data before generating code.

---

## Step 3: Detect project conventions

Same detection as `/ui` — framework, styling approach, component directory, naming conventions, TypeScript.

```bash
cat package.json 2>/dev/null | grep -E '"react"|"vue"|"svelte"|"next"|"nuxt"|"astro"'
ls tailwind.config.* 2>/dev/null
ls -d src/components/ app/components/ components/ 2>/dev/null
```

---

## Step 4: Map Figma to code

Apply the mapping rules from `design-to-code/figma-mapping.md`. Key mappings:

### Layout
| Figma | CSS |
|-------|-----|
| Auto-layout horizontal | `display: flex; flex-direction: row` |
| Auto-layout vertical | `display: flex; flex-direction: column` |
| Auto-layout gap | `gap: Xpx` |
| Auto-layout padding | `padding: T R B L` |
| Fill container | `flex: 1` or `width: 100%` |
| Hug contents | `width: fit-content` |
| Fixed size | `width: Xpx` |
| Auto-layout wrap | `flex-wrap: wrap` |

### Typography
| Figma | CSS |
|-------|-----|
| Font family | `font-family` (map to project's font stack) |
| Font size | `font-size` (convert to rem if project uses rem) |
| Font weight | `font-weight` |
| Line height | `line-height` (convert % to unitless) |
| Letter spacing | `letter-spacing` (convert % to em) |
| Text align | `text-align` |
| Text decoration | `text-decoration` |

### Colors & Effects
| Figma | CSS |
|-------|-----|
| Solid fill | `background-color` or `color` |
| Gradient fill | `background: linear-gradient(...)` |
| Drop shadow | `box-shadow` |
| Inner shadow | `box-shadow: inset ...` |
| Layer blur | `filter: blur(Xpx)` |
| Background blur | `backdrop-filter: blur(Xpx)` |
| Border radius | `border-radius` |
| Stroke | `border` |

### Responsive strategy
- Figma frames < 768px → mobile styles
- Figma frames 768-1024px → tablet
- Figma frames > 1024px → desktop
- Use `min-width` media queries (mobile-first)

---

## Step 5: Generate the component

1. **Component structure** — break the Figma frame into logical sub-components if complex
2. **Main component** — map the hierarchy to semantic HTML + CSS
3. **Styles** — generate in the project's styling approach (Tailwind classes, CSS Modules, etc.)
4. **Props interface** — extract variants as props (size, variant, state)
5. **Responsive behavior** — implement breakpoint-specific styles
6. **Interactions** — hover/focus/active states from Figma prototyping if available

### Ambiguity resolution

If unsure about any of the following, use AskUserQuestion (one question at a time):
- Breakpoint behavior (which Figma frame maps to which breakpoint?)
- Animation/transition details not captured in Figma
- Dynamic content (is this text static or a prop?)
- Component boundaries (should this be one component or split into smaller ones?)

---

## Step 6: Generate basic tests

If the project has a test setup:

```
- Component renders without errors
- Key visual elements are present (headings, images, buttons)
- Variants render correctly (pass different props)
- Responsive classes/styles are applied
```

---

## Step 7: Design fidelity checklist

Before finishing, verify:

- [ ] All Figma spacing values are accurately mapped
- [ ] Typography matches (font, size, weight, line-height, letter-spacing)
- [ ] Colors match (use design tokens if the project has them)
- [ ] Border radius matches
- [ ] Shadows match
- [ ] Layout behaves correctly at different widths
- [ ] Interactive states (hover, focus, active) are implemented
- [ ] Images/icons have alt text or aria-label

Output the checklist results and any deviations from the design with explanations.

---

## Important Rules

- **Pixel accuracy matters.** Match the Figma design as closely as possible. Deviate only when the design conflicts with web standards or accessibility.
- **Semantic HTML always.** Use `nav`, `main`, `article`, `section`, `button`, `a` — never `div` soup.
- **Never hardcode content** that should be dynamic. Use props.
- **Respect the project's design tokens.** If the project has CSS custom properties or a Tailwind config, use existing values. Don't introduce new magic numbers.
- **Ask before adding dependencies.** If the design requires an icon library, carousel, etc., inform the user first.
