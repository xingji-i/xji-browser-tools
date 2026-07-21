# Highlight AutoRead — Combined Highlight and Auto-Scroll Reading

> A Manifest V3 Chrome extension that merges line-by-line highlighting with automatic page scrolling, creating a hands-free "teleprompter" reading experience for any web page.

---

## Table of Contents

- [Features](#features)
- [Two Reading Modes](#two-reading-modes)
- [Installation](#installation)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Content Detection Algorithm](#content-detection-algorithm)
- [Speed Control](#speed-control)
- [Architecture](#architecture)
- [Technical Notes: Scroll Engine](#technical-notes-scroll-engine)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

- **Auto-Read mode** — The page advances line by line on its own, highlighting the current reading line and smooth-scrolling to keep it centered in the viewport.
- **Highlight-Only mode** — Manual line-by-line navigation with `Ctrl + Down` / `Ctrl + Up`, with the same highlight and scroll behavior but no auto-advance.
- **Smart content detection** — A multi-stage algorithm identifies the main reading area of the page, filtering out navigation, sidebars, footers, and advertisements.
- **30+ CSS selectors** — Covers PDF.js, Markdown renderers, GitHub, articles, code blocks, and generic HTML structures.
- **10-step speed control** — Adjust the reading pace from a relaxed 8 seconds per line to a brisk 0.8 seconds.
- **Position memory** — Restores your reading position across page reloads and revisits.
- **MutationObserver** — Keeps the line list accurate on single-page applications with dynamic content.
- **Floating indicator** — A small on-page badge shows whether Auto-Read is active, paused, or in Highlight-Only mode.
- **Popup control panel** — Color pickers, line counter, go-to-line input, and content root display.
- **Customizable highlight colors** — Background and text colors configurable via the popup.

---

## Two Reading Modes

### Auto-Read Mode

The signature mode. Once activated, the extension:

1. Identifies all navigable text lines on the page using the content detection algorithm.
2. Highlights the first line and scrolls it to the vertical center of the viewport.
3. Waits for the configured dwell time (speed setting).
4. Advances to the next line — removes the highlight from the current line, highlights the next, and smooth-scrolls.
5. Repeats until the end of the document or until the user pauses.

This creates a "teleprompter" effect: the text flows past your eyes at a comfortable pace, and the highlighted line is always centered. Ideal for long-form reading, studying documentation, or reviewing drafts hands-free.

### Highlight-Only Mode

The same highlighting and centering behavior, but **without auto-advance**. You control the pace entirely with `Ctrl + Down` (next line) and `Ctrl + Up` (previous line). Useful when you want the visual focus benefit of line highlighting but need to read at your own pace — for example, when studying dense technical material.

---

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `highlight-autoread` directory.
5. The extension icon appears in the toolbar. Navigate to any page and press `Ctrl + Space` to start Auto-Read mode.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Space` | Toggle Auto-Read mode (start / pause / resume) |
| `Ctrl + Down` | Next line (works in both Auto-Read and Highlight-Only modes) |
| `Ctrl + Up` | Previous line (works in both modes) |
| `Ctrl + Shift + L` | Toggle Highlight-Only mode (highlight on/off without auto-advance) |

Shortcuts can be customized at `chrome://extensions/shortcuts`.

---

## Content Detection Algorithm

The extension uses a **three-stage pipeline** to identify the lines worth reading:

### Stage 1 — Semantic Tag Quick Match

The engine first checks for high-confidence semantic elements that almost certainly contain the primary content:

```
<article>, <main>, <section> (with role="main"), [role="article"]
```

If exactly one strong candidate is found and it contains sufficient text, it is selected as the content root immediately — no further scoring needed.

### Stage 2 — Container Scoring

When no single semantic element dominates, the engine evaluates all candidate container elements using a weighted scoring formula:

```
score = (childCount × 3) + log2(textLength) + semanticBonus
```

| Factor | Weight | Rationale |
|--------|--------|-----------|
| `childCount` | × 3 | Containers with many child elements are likely document bodies, not sidebars |
| `textLength` | log₂ | Longer text is better, but with diminishing returns (prevents a single long `<div>` from dominating) |
| `semanticBonus` | +10 to +25 | Bonus points for semantic tags (`<article>` +25, `<main>` +20, `<section>` +15, `<div>` with `class="content"` +10) |

The container with the highest score is selected as the content root.

### Stage 3 — Filtering

Regardless of which container is selected, certain elements are **always excluded** from the navigation list:

- `<nav>`, `<aside>`, `<footer>`, `<header>` (when not inside the content root)
- Elements with sidebar, ad, or navigation-related class names or ARIA roles
- Elements with `display: none` or `visibility: hidden`
- Elements with zero computed dimensions

### Fallback

If no suitable container is found (score below threshold), the engine falls back to `<body>`. This ensures the extension works on every page, even minimal or unconventional layouts.

---

## Speed Control

The popup exposes a **10-step slider** that maps to the following dwell times (seconds spent on each line before advancing):

| Step | Dwell (seconds) | Pace |
|------|-----------------|------|
| 1 | 8.0 | Very slow — careful study |
| 2 | 6.0 | Slow — thorough reading |
| 3 | 5.0 | Relaxed |
| 4 | 4.0 | Moderate |
| 5 | 3.0 | Comfortable |
| 6 | 2.5 | Brisk |
| 7 | 2.0 | Fast |
| 8 | 1.5 | Very fast |
| 9 | 1.2 | Skimming |
| 10 | 0.8 | Rapid scan |

The speed setting can be adjusted in real time while Auto-Read is active — the change takes effect on the next line advance.

---

## Architecture

```
highlight-autoread/
├── manifest.json              # Manifest V3 configuration
├── background.js              # Service worker — shortcut relay, tab management
├── content.js                 # Core engine — content detection, line navigation,
│                              #   highlight state, auto-read timer, scroll engine
├── style.css                  # Highlight styles (CSS custom properties)
├── popup/
│   ├── popup.html             # Control panel UI
│   ├── popup.js               # Speed slider, color pickers, line counter,
│   │                          #   go-to-line, content root display
│   └── popup.css
└── icons/
```

### Component Responsibilities

**`background.js`** — Listens for `chrome.commands.onCommand` events and relays them to the active tab's content script. Also manages cross-tab state coordination if needed.

**`content.js`** — The core engine, responsible for:

- Running the three-stage content detection algorithm.
- Building and maintaining the sorted, deduplicated line list.
- Managing the highlight state machine (idle → auto-reading → paused → highlight-only).
- Running the auto-read timer (`setTimeout` loop with configurable dwell).
- Executing smooth scrolls and handling scroll position conflicts.
- Persisting and restoring reading position.
- Observing DOM mutations for SPA support.
- Rendering the floating mode indicator.

**`style.css`** — Defines the highlight class and mode indicator styles using CSS custom properties for runtime theming.

**`popup/`** — Control panel that communicates with the content script via `chrome.tabs.sendMessage`. Displays real-time state (current line, total lines, content root element, active mode) and sends commands (toggle auto-read, change speed, update colors, go-to-line).

### Permissions

| Permission | Purpose |
|-----------|---------|
| `activeTab` | Access the current tab's DOM for content detection and highlighting |
| `storage` | Persist settings (speed, colors, position) and user preferences |

---

## Technical Notes: Scroll Engine

The scroll engine is one of the most nuanced parts of the extension. It must coordinate programmatic auto-scroll with the possibility of user-initiated scroll, without jitter or position fights.

### rAF Position Comparison (Replaces Scroll Event Listener)

Early versions used a `scroll` event listener to detect when the user manually scrolled the page, which would conflict with the auto-scroll. This approach is unreliable because:

- `scroll` events fire for both programmatic and user scrolls.
- Distinguishing the two requires fragile heuristics.
- High-frequency scroll events can cause performance issues.

The current implementation uses **`requestAnimationFrame` position comparison** instead:

```
On each animation frame:
  1. Read current scroll position (window.scrollY or documentElement.scrollTop).
  2. Compare with the expected position (last known target).
  3. If the difference exceeds a threshold AND _programScroll is false:
     → User has manually scrolled. Pause auto-read or adjust target.
  4. Update last known position.
```

This runs at display refresh rate (typically 60 fps) and is extremely lightweight — no event listener overhead, no debouncing needed.

### `_programScroll` Flag

When the extension initiates a programmatic scroll (via `scrollIntoView` or `window.scrollTo`), it sets the `_programScroll` flag to `true`. This flag is cleared after **1200 milliseconds**, giving the smooth scroll animation time to complete. While the flag is active, the rAF observer ignores position changes, preventing the engine from misinterpreting its own scroll as user interference.

```
_programScroll lifecycle:
  1. Extension calls element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  2. _programScroll = true
  3. Browser animates the scroll (~300–600ms)
  4. 1200ms timer expires → _programScroll = false
  5. rAF observer resumes normal position monitoring
```

### `scrollIntoView` with Fallback

The primary scroll method is:

```javascript
element.scrollIntoView({ behavior: 'smooth', block: 'center' });
```

This asks the browser to smoothly scroll the element into the vertical center of the viewport. However, `scrollIntoView` can fail or behave unexpectedly when:

- The element is inside a scrollable container that is not the document root.
- The page has `overflow: hidden` on the body.
- A CSS `scroll-snap` policy interferes.

In these cases, the engine falls back to a manual scroll:

```javascript
const rect = element.getBoundingClientRect();
const targetY = window.scrollY + rect.top - (window.innerHeight / 2) + (rect.height / 2);
window.scrollTo({ top: targetY, behavior: 'smooth' });
```

This fallback computes the exact scroll position needed to center the element and scrolls the window directly, bypassing the container-level logic that `scrollIntoView` uses.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Auto-Read skips the main content | Content detection chose the wrong container | Check the popup's "Content Root" display; if incorrect, the page layout may be unusual |
| Page "fights" the auto-scroll | Scroll conflict with page scripts or extensions | The rAF engine should handle this, but aggressive page scripts may interfere; try pausing and resuming |
| Auto-Read stops mid-document | DOM mutation removed highlighted element | The MutationObserver should rebuild the line list; if it persists, toggle auto-read off and on |
| Highlight not visible | Color blends with page background | Change the highlight background color via the popup color picker |
| Speed feels too fast or slow | Dwell time mismatch | Adjust the speed slider in the popup (10 steps available) |
| Position not restored after reload | Page content changed significantly | Text-match failed and index fallback landed elsewhere; re-navigate to your position manually |

---

## License

This project is provided as-is for personal and educational use. See the [LICENSE](../LICENSE) file in the repository root for details.
