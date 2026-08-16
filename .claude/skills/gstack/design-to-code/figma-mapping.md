# Figma to CSS/React Mapping Reference

This document provides the complete mapping table used by `/design-to-code` to convert Figma properties into web code.

---

## Layout (Auto-layout)

| Figma Property | CSS Equivalent | Notes |
|----------------|---------------|-------|
| Auto-layout: Horizontal | `display: flex; flex-direction: row` | |
| Auto-layout: Vertical | `display: flex; flex-direction: column` | |
| Gap (item spacing) | `gap: Xpx` | Single value for uniform spacing |
| Padding (top, right, bottom, left) | `padding: T R B L` | Figma allows per-side padding |
| Primary axis: Space between | `justify-content: space-between` | |
| Primary axis: Center | `justify-content: center` | |
| Primary axis: Start | `justify-content: flex-start` | Default |
| Primary axis: End | `justify-content: flex-end` | |
| Counter axis: Center | `align-items: center` | |
| Counter axis: Start | `align-items: flex-start` | |
| Counter axis: End | `align-items: flex-end` | |
| Counter axis: Stretch | `align-items: stretch` | |
| Wrap | `flex-wrap: wrap` | |
| Clip content | `overflow: hidden` | |

## Sizing

| Figma Property | CSS Equivalent | Notes |
|----------------|---------------|-------|
| Fixed width/height | `width: Xpx; height: Ypx` | Convert to rem if project uses rem |
| Hug contents | `width: fit-content` | Or omit width (natural sizing) |
| Fill container | `flex: 1` or `width: 100%` | `flex: 1` preferred in flex contexts |
| Min width/height | `min-width: Xpx; min-height: Ypx` | |
| Max width/height | `max-width: Xpx; max-height: Ypx` | |

## Typography

| Figma Property | CSS Equivalent | Conversion |
|----------------|---------------|------------|
| Font family | `font-family` | Map to project's font stack |
| Font size | `font-size` | `px / 16 = rem` if project uses rem |
| Font weight | `font-weight` | 100-900 numeric scale |
| Line height | `line-height` | `% / 100 = unitless` (e.g., 150% → 1.5) |
| Letter spacing | `letter-spacing` | `% / 100 * font-size = em` |
| Text align | `text-align` | left, center, right, justify |
| Text decoration | `text-decoration` | underline, line-through, none |
| Text transform | `text-transform` | uppercase, lowercase, capitalize |
| Paragraph spacing | `margin-bottom` on `<p>` | Applied between paragraphs |
| Text truncation | `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` | Single line truncation |
| Max lines | `-webkit-line-clamp: N; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden` | Multi-line truncation |

## Colors & Fills

| Figma Property | CSS Equivalent | Notes |
|----------------|---------------|-------|
| Solid fill (background) | `background-color: #HEX` or `rgb(R, G, B)` | Use project tokens if available |
| Solid fill (text) | `color: #HEX` | |
| Opacity on fill | `background-color: rgba(R, G, B, A)` | Or `opacity` on the element |
| Linear gradient | `background: linear-gradient(Xdeg, color1 stop1%, color2 stop2%)` | Convert Figma angle |
| Radial gradient | `background: radial-gradient(...)` | |
| Image fill | `background-image: url(...)` + `background-size: cover/contain` | Export from Figma |

## Effects

| Figma Property | CSS Equivalent | Notes |
|----------------|---------------|-------|
| Drop shadow | `box-shadow: Xpx Ypx Bpx Spx color` | X=offset-x, Y=offset-y, B=blur, S=spread |
| Inner shadow | `box-shadow: inset Xpx Ypx Bpx Spx color` | |
| Layer blur | `filter: blur(Xpx)` | |
| Background blur | `backdrop-filter: blur(Xpx)` | Add `-webkit-` prefix for Safari |
| Multiple shadows | Comma-separated `box-shadow` values | Order matters |

## Borders & Corners

| Figma Property | CSS Equivalent | Notes |
|----------------|---------------|-------|
| Stroke (all sides) | `border: Wpx solid color` | |
| Stroke (per side) | `border-top: ...` etc. | |
| Stroke inside | `box-sizing: border-box` (default) | |
| Stroke outside | `outline: Wpx solid color` | Or use `box-shadow` |
| Stroke center | Rare — use `border` with adjusted sizing | |
| Border radius (uniform) | `border-radius: Xpx` | |
| Border radius (per corner) | `border-radius: TL TR BR BL` | |
| Smoothing (iOS) | Not directly mappable | Approximate with larger radius values |

## Constraints (Responsive Hints)

| Figma Constraint | CSS Strategy | Notes |
|------------------|-------------|-------|
| Left + Right (stretch) | `position: absolute; left: X; right: Y` or `width: 100%` with margins | Prefer flex/grid |
| Center | `margin: 0 auto` or flex centering | |
| Scale | `width: X%` | Percentage-based sizing |
| Left only | Natural flow (default) | |
| Right only | `margin-left: auto` or flex `justify-content: flex-end` | |

## Component Variants → Props

| Figma Concept | React/Vue Pattern |
|---------------|-------------------|
| Component set | Single component with variant props |
| Boolean property | `disabled?: boolean`, `loading?: boolean` |
| Instance swap | Slot/children or icon prop |
| Text property | String prop |
| Variant property | Union type prop: `variant: "primary" \| "secondary"` |

## Responsive Breakpoints

| Figma Frame Width | Breakpoint | Tailwind Class Prefix |
|-------------------|------------|----------------------|
| < 640px | Mobile | (default / `sm:`) |
| 640-767px | Small tablet | `sm:` |
| 768-1023px | Tablet | `md:` |
| 1024-1279px | Desktop | `lg:` |
| 1280-1535px | Large desktop | `xl:` |
| >= 1536px | Extra large | `2xl:` |
