# Stitch Advanced Workflows Reference

Reference document for the `/ui` skill's Google Stitch integration.

---

## Stitch MCP Tools

When `mcp__stitch__*` tools are available, these capabilities are exposed:

| Capability | Description |
|-----------|-------------|
| `list_projects` | List existing Stitch projects |
| Create project | Start a new design project |
| Generate UI | Send a prompt, get a design |
| Pull code | Extract HTML/CSS from a design |
| Extract screenshots | Get PNG/SVG of designs |
| Read design system | Get colors, typography, spacing tokens |
| Export Figma | Export with Auto Layout preserved |

---

## Prompt engineering for Stitch

### Effective prompts

**Be specific about layout and content:**
```
Create a SaaS pricing page with 3 tiers (Free, Pro, Enterprise).
Each tier is a card with: name, price, feature list (5-8 items), CTA button.
Pro tier is highlighted with a "Most Popular" badge.
Use a clean, modern design with plenty of whitespace.
Color scheme: primary blue (#3B82F6), neutral grays.
```

**For vibe design, describe the aesthetic:**
```
Brutalist dark mode dashboard. Sharp corners, monospace typography,
neon green accents on black. Dense information layout like a terminal.
No rounded corners, no gradients, no soft shadows.
```

**For iterative refinement:**
```
Make the header sticky with a blur backdrop.
Reduce the card padding by 25%.
Add a subtle gradient to the hero section.
Switch the CTA buttons from outline to filled style.
```

### Mode selection

| Scenario | Mode | Why |
|----------|------|-----|
| Simple component (button, card, input) | Standard (Gemini Flash) | Fast, saves quota |
| Complex layout (dashboard, landing page) | Experimental (Gemini Pro) | Better spatial reasoning |
| Design system exploration | Standard | Multiple quick iterations |
| Final production design | Experimental | Highest fidelity |

---

## DESIGN.md integration

### When to create DESIGN.md

- Project has no existing design system tokens
- User asks to "bootstrap a design system"
- First `/ui` invocation on a new project
- User says "make it consistent with [URL]"

### When to read DESIGN.md

- Always check for DESIGN.md before generating any component
- Use its tokens as constraints for Stitch prompts
- Reference its patterns in Magic MCP searches

### DESIGN.md lifecycle

```
1. Extract from URL or first Stitch generation
2. Save at project root
3. Read on every /ui invocation
4. Update when design system evolves
5. Share with /design-to-code skill
```

---

## Stitch + Figma bridge

When the team uses Figma:

1. **Stitch → Figma**: Export Stitch designs to Figma for team review
2. **Figma → Code**: Use `/design-to-code` with Figma MCP for approved designs
3. **Stitch as ideation, Figma as handoff**: Stitch generates fast, Figma preserves

---

## Stitch + Magic MCP synergy

| Phase | Stitch | Magic MCP |
|-------|--------|-----------|
| **Ideation** | Generate visual designs | Search component patterns |
| **Refinement** | Polish the design | Get animation/interaction patterns |
| **Code generation** | Export base HTML/CSS | Build production component |
| **Polish** | — | Refine component quality |

The workflow: Stitch designs the **what it looks like**, Magic MCP provides **how to build it well**.

---

## Quota management

Stitch free tier limits:
- **Standard Mode**: 350 generations/month
- **Experimental Mode**: 50 generations/month

Conservation strategy:
- Use Standard for exploration and iteration
- Switch to Experimental only for final production designs
- Batch related changes into single prompts
- Use conversational refinement instead of regenerating from scratch
