# Doc Line Highlight — Line-by-Line Highlighted Reading

> A Manifest V3 Chrome extension that enables precise, keyboard-driven line-by-line navigation with visual highlighting across a wide range of web content types.

---

## Table of Contents

- [Features](#features)
- [Supported Content Types](#supported-content-types)
- [Installation](#installation)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Architecture](#architecture)
- [Technical Notes](#technical-notes)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

### Keyboard-Driven Line Navigation

Move through a document one line at a time using `Ctrl + Down` and `Ctrl + Up`. The currently focused line is visually highlighted, and the page smoothly scrolls to keep it centered in the viewport. No mouse required.

### Extensive Selector Coverage (30+ CSS Selectors)

The content engine ships with over 30 CSS selectors covering the most common document structures on the web:

- **PDF.js** — Mozilla's PDF viewer paragraph spans
- **Markdown renderers** — GitHub, GitLab, and generic Markdown paragraph elements
- **GitHub** — README blobs, issue bodies, pull request descriptions, code blocks
- **Articles** — Standard `<article>`, `<p>`, `<li>`, and semantic HTML5 elements
- **Code blocks** — `<pre>`, `<code>`, line-numbered code containers
- **Fallback** — Generic block-level elements when no specific match is found

### DOM-Order Sorting

Matched elements are sorted by their position in the DOM tree (using `compareDocumentPosition`), not by their visual bounding-box coordinates. This ensures a natural reading order that respects the document's logical structure, even when CSS layout (flexbox, grid, floats) reorders elements visually.

### Parent-Child Deduplication

When a parent element and its child both match the selector set, the parent is removed from the navigation list. This prevents the same text from being highlighted twice as you step through the document.

### Popup Control Panel

The extension popup provides a compact control interface:

- **Line counter** — Displays the current line number and total line count (e.g., "42 / 318").
- **Toggle button** — Enable or disable highlighting without losing your position.
- **Go-to-line input** — Jump directly to any line number.
- **Color pickers** — Customize the highlight background color and text color to match your reading preferences or accessibility needs.

### Position Memory

When you navigate away from a page and return, the extension attempts to restore your reading position using a **text-match strategy**: it searches for the exact text content of the previously highlighted line. If the text cannot be found (e.g., the page has changed), it falls back to the **numeric index** of the line within the element list. This two-tier approach provides robust position persistence across sessions.

### SPA Support via MutationObserver

A `MutationObserver` watches for DOM mutations that add or remove navigable elements. This keeps the line list accurate on single-page applications (SPAs) where content loads dynamically without full page reloads — common on sites like GitHub, Gmail, and documentation platforms.

### Dual Shortcut Mechanism

Shortcuts are registered at two levels:

1. **Manifest-declared commands** (`chrome.commands`) — handled by the background service worker and relayed to the active tab.
2. **In-page keyboard listeners** — content script listens for the same key combinations directly.

This dual approach ensures shortcuts work reliably regardless of focus state or page context.

### Skip Empty Lines

Elements that contain only whitespace, are visually hidden, or have zero dimensions are automatically excluded from the navigation list. You will never land on a blank line.

### Auto-Scroll to Center

Each time a new line is highlighted, the page scrolls so that the line is positioned at the vertical center of the viewport. This provides a stable, comfortable reading rhythm — your eyes do not have to chase the highlight up and down the screen.

---

## Supported Content Types

| Content Type | Examples |
|-------------|----------|
| PDF documents | Files opened in Chrome's PDF.js viewer |
| Markdown | GitHub/GitLab README, rendered `.md` files |
| Source code | GitHub file viewer, Pastebin, code blogs |
| Articles & blog posts | Medium, Substack, WordPress, news sites |
| Documentation | MDN, ReadTheDocs, API reference pages |
| GitHub | Issues, PR descriptions, wikis, discussion threads |
| Generic HTML | Any page with block-level text elements |

---

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `doc-line-highlight` directory.
5. The extension icon appears in the toolbar. Navigate to any web page and press `Ctrl + Down` to begin.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Down` | Move to the next line and highlight it |
| `Ctrl + Up` | Move to the previous line and highlight it |
| `Ctrl + Shift + L` | Toggle highlighting on or off |

Shortcuts can be customized at `chrome://extensions/shortcuts`.

---

## Architecture

```
doc-line-highlight/
├── manifest.json              # Manifest V3 configuration
├── background.js              # Service worker — relays shortcut commands to content script
├── content.js                 # Core engine — line detection, highlighting, navigation, position memory
├── style.css                  # Highlight styles (.dlh-highlight class with CSS custom properties)
├── popup/
│   ├── popup.html             # Control panel UI
│   ├── popup.js               # Popup logic (line counter, go-to, color pickers, toggle)
│   └── popup.css
└── icons/
```

### Component Responsibilities

**`background.js`** — Listens for `chrome.commands.onCommand` events and sends a message to the active tab's content script. This ensures that manifest-declared shortcuts are forwarded even when the page does not have focus on the content script's event listeners.

**`content.js`** — The main engine. Responsibilities include:

- Querying the DOM with the 30+ selector set.
- Sorting elements by DOM order.
- Deduplicating parent-child overlaps.
- Filtering out empty and invisible elements.
- Managing the highlight state (current index, active/inactive).
- Handling keyboard events for line navigation.
- Persisting and restoring reading position.
- Observing DOM mutations for SPA support.

**`style.css`** — Defines the `.dlh-highlight` class and its associated CSS custom properties (`--dlh-bg`, `--dlh-color`). Using custom properties allows the popup's color pickers to update the highlight appearance in real time by writing new values to the element's style.

**`popup/`** — A lightweight control panel that communicates with the content script via `chrome.tabs.sendMessage` to read the current state and send commands.

### Permissions

| Permission | Purpose |
|-----------|---------|
| `activeTab` | Access the current tab's DOM for line detection and highlighting |
| `storage` | Persist settings (colors, position memory) and user preferences |

---

## Technical Notes

### Why DOM-Order Sort Instead of Visual Sort?

Visual sort (comparing `getBoundingClientRect().top`) is tempting but fragile. It breaks on:

- Multi-column layouts where the second column's first paragraph is visually below the first column's last paragraph, but should be read next in DOM order.
- Sticky or fixed elements that appear visually inline but are positioned elsewhere in the DOM.
- Pages that reorder elements with CSS `order` or `flex-direction: row-reverse`.

DOM-order sort (`Node.compareDocumentPosition`) is deterministic, fast, and aligns with the author's intended reading sequence in the vast majority of cases.

### Highlight Rendering

The highlight is applied by adding the `.dlh-highlight` CSS class to the target element, rather than wrapping text in inline `<span>` elements. This approach:

- Preserves the original DOM structure (no tree mutations that could break page scripts).
- Avoids conflicts with selection ranges and copy-paste.
- Is trivially reversible (remove the class to un-highlight).

### Position Memory Strategy

```
On page unload:
  1. Read currentLine.textContent → store as `savedText`
  2. Read currentLine index in element list → store as `savedIndex`

On page load:
  1. Build element list
  2. Search list for element with textContent === savedText
  3. If found → restore to that element
  4. Else → restore to element at savedIndex (clamped to list bounds)
  5. Else → start at index 0
```

### CSS Custom Properties for Theming

The highlight colors are driven by CSS custom properties rather than hardcoded values:

```css
.dlh-highlight {
  background-color: var(--dlh-bg, #fff176);
  color: var(--dlh-color, inherit);
}
```

The content script sets these properties on the document root, and the popup updates them in real time when the user picks new colors. This decouples styling from logic and avoids repeated DOM writes to every highlighted element.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Ctrl+Down` does nothing on a page | No matching elements found | The page may use an unusual structure; check the browser console for the element count logged by the extension |
| Highlight jumps to wrong position after restore | Page content changed between visits | Text-match failed and index fallback landed on a different element; re-navigate manually |
| Shortcuts conflict with browser/OS shortcuts | System-level key bindings take priority | Remap the extension shortcuts at `chrome://extensions/shortcuts` |
| Highlight not visible on dark pages | Default highlight color blends with background | Change the highlight background color via the popup color picker |

---

## License

This project is provided as-is for personal and educational use. See the [LICENSE](../LICENSE) file in the repository root for details.
