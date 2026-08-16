# WCAG 2.1 Level AA Checklist

Organized by the four WCAG principles. Each criterion includes the success criterion number, a brief description, and what to check.

---

## 1. Perceivable

Information and UI components must be presentable in ways users can perceive.

### 1.1 Text Alternatives
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 1.1.1 Non-text Content | All non-text content has a text alternative | `<img alt>`, SVG `<title>` or `aria-label`, `<input type="image" alt>`, decorative images have `alt=""` or `aria-hidden="true"` |

### 1.2 Time-based Media
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 1.2.1 Audio-only / Video-only | Alternatives for pre-recorded media | Transcripts for audio, text/audio descriptions for video |
| 1.2.2 Captions | Captions for pre-recorded audio in video | `<track kind="captions">` or embedded captions |
| 1.2.3 Audio Description | Audio description for pre-recorded video | Alternative track or separate described version |
| 1.2.5 Audio Description (Prerecorded) | Audio description for all prerecorded video | Same as 1.2.3 but required at AA |

### 1.3 Adaptable
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 1.3.1 Info and Relationships | Structure conveyed through markup | Semantic HTML (`<nav>`, `<main>`, `<article>`), headings hierarchy, `<table>` with `<th>`, list markup, form labels |
| 1.3.2 Meaningful Sequence | Reading order is logical | DOM order matches visual order, CSS doesn't reorder content misleadingly |
| 1.3.3 Sensory Characteristics | Instructions don't rely solely on shape/size/position/sound | "Click the round button" → also provide text label reference |
| 1.3.4 Orientation | Content not restricted to single orientation | No CSS that locks to portrait/landscape via `orientation` media query |
| 1.3.5 Identify Input Purpose | Input purpose can be programmatically determined | `autocomplete` attributes on personal data inputs (name, email, phone, address) |

### 1.4 Distinguishable
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 1.4.1 Use of Color | Color not sole means of conveying info | Error states use icon + text, not just red color |
| 1.4.2 Audio Control | Auto-playing audio can be paused/stopped | No auto-play, or controls provided within 3 seconds |
| 1.4.3 Contrast (Minimum) | 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold) | Check computed styles, verify against background |
| 1.4.4 Resize Text | Text can be resized to 200% without loss | Test with browser zoom, use relative units (rem, em) |
| 1.4.5 Images of Text | Real text used instead of images of text | No text baked into images (logos excepted) |
| 1.4.10 Reflow | Content reflows at 320px width (400% zoom) | No horizontal scrollbar at 320px, content remains usable |
| 1.4.11 Non-text Contrast | UI components and graphics have 3:1 contrast | Borders on inputs, icon colors, chart elements |
| 1.4.12 Text Spacing | Content works with increased text spacing | Line height 1.5x, paragraph spacing 2x, letter spacing 0.12em, word spacing 0.16em |
| 1.4.13 Content on Hover or Focus | Hoverable/focusable extra content is dismissible, hoverable, persistent | Tooltips: Esc to dismiss, can hover over tooltip, stays until user acts |

---

## 2. Operable

UI components and navigation must be operable.

### 2.1 Keyboard Accessible
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 2.1.1 Keyboard | All functionality available via keyboard | Tab through all interactive elements, Enter/Space to activate, Arrow keys for widgets |
| 2.1.2 No Keyboard Trap | Focus is not trapped (except modals with documented escape) | Tab moves through all elements and back to browser chrome |
| 2.1.4 Character Key Shortcuts | Single-character shortcuts can be remapped/disabled | If present, provide setting to disable or remap |

### 2.2 Enough Time
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 2.2.1 Timing Adjustable | Time limits can be adjusted | Session timeouts have warnings, auto-advancing content can be paused |
| 2.2.2 Pause, Stop, Hide | Moving/auto-updating content can be controlled | Carousels have pause button, auto-scrolling content has controls |

### 2.3 Seizures and Physical Reactions
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 2.3.1 Three Flashes or Below Threshold | No content flashes > 3 times per second | Animations, video content, loading spinners |

### 2.4 Navigable
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 2.4.1 Bypass Blocks | Skip navigation link available | "Skip to main content" link, landmark regions |
| 2.4.2 Page Titled | Pages have descriptive titles | `<title>` tag, dynamic updates on SPA navigation |
| 2.4.3 Focus Order | Focus order preserves meaning | Tab order follows visual/logical order |
| 2.4.4 Link Purpose | Link purpose clear from text (or context) | No "click here" links, descriptive anchor text |
| 2.4.5 Multiple Ways | Multiple ways to find pages | Navigation menu + search + sitemap |
| 2.4.6 Headings and Labels | Headings and labels are descriptive | Headings describe content, labels describe input purpose |
| 2.4.7 Focus Visible | Keyboard focus indicator is visible | `outline` or custom focus style, no `outline: none` without replacement |

### 2.5 Input Modalities
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 2.5.1 Pointer Gestures | Multi-point/path gestures have single-pointer alternatives | Pinch-zoom has +/- buttons, swipe has next/prev buttons |
| 2.5.2 Pointer Cancellation | Down-event doesn't trigger action (use click/up-event) | No `mousedown`/`touchstart` for actions, use `click` |
| 2.5.3 Label in Name | Visible label matches accessible name | Button text = `aria-label` (or aria-label includes visible text) |
| 2.5.4 Motion Actuation | Motion-triggered actions have UI alternatives | Shake-to-undo has button alternative |

---

## 3. Understandable

Information and UI operation must be understandable.

### 3.1 Readable
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 3.1.1 Language of Page | Page language declared | `<html lang="en">` (or appropriate language) |
| 3.1.2 Language of Parts | Language changes marked | `<span lang="fr">` for inline foreign text |

### 3.2 Predictable
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 3.2.1 On Focus | Focus doesn't trigger unexpected changes | No page navigation on focus, no popups on focus |
| 3.2.2 On Input | Input doesn't trigger unexpected changes | No form submission on select change without warning |
| 3.2.3 Consistent Navigation | Navigation is consistent across pages | Same nav order, same elements |
| 3.2.4 Consistent Identification | Same function = same label | Search always labeled "Search", not sometimes "Find" |

### 3.3 Input Assistance
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 3.3.1 Error Identification | Errors identified and described in text | Error messages near the input, not just color change |
| 3.3.2 Labels or Instructions | Labels or instructions for user input | All inputs labeled, complex forms have instructions |
| 3.3.3 Error Suggestion | Error messages suggest corrections | "Email must include @" not just "Invalid email" |
| 3.3.4 Error Prevention (Legal/Financial) | Reversible, checked, or confirmed submissions | Confirmation step for purchases, ability to review before submit |

---

## 4. Robust

Content must be robust enough for diverse user agents and assistive technologies.

### 4.1 Compatible
| Criterion | Description | What to Check |
|-----------|-------------|---------------|
| 4.1.1 Parsing | No duplicate IDs, proper nesting | Validate HTML, check for duplicate `id` attributes |
| 4.1.2 Name, Role, Value | Custom components expose name/role/value | ARIA roles on custom widgets, `aria-valuenow` on sliders, `aria-expanded` on accordions |
| 4.1.3 Status Messages | Status messages announced without focus | `aria-live="polite"` for success messages, `aria-live="assertive"` for errors, `role="alert"` for urgent |
