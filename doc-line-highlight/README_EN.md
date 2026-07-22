# Doc Line Highlight - Document Line-by-Line Highlighting

**[中文](README.md)** | English

A Manifest V3 browser extension for line-by-line highlighted reading of web page text. Navigate between text lines using keyboard shortcuts — the current line is highlighted with a custom-color background and outline, and automatically scrolled into the center of the viewport. Ideal for reading web articles, technical documentation, Markdown pages, PDF.js-rendered PDFs, GitHub code, and more.

---

## Table of Contents

- [Core Features](#core-features)
- [Supported Content Types](#supported-content-types)
- [Installation](#installation)
- [Usage](#usage)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Architecture](#architecture)
- [Technical Details](#technical-details)
- [Project Structure](#project-structure)
- [License](#license)

---

## Core Features

- **Line-by-line highlight navigation** - `Ctrl+Down` / `Ctrl+Up` to move between text lines, with the current line highlighted and auto-scrolled to center (`scrollIntoView` smooth)
- **Broad text recognition** - 30+ CSS selectors covering mainstream reading scenarios: PDF.js text layers, Markdown renderers, GitHub code views, generic article containers, code blocks, tables, lists, etc.
- **DOM-order sorting** - Uses `compareDocumentPosition` to sort elements in document order, ensuring reading order matches visual order
- **Parent-child deduplication** - When both a parent and child element are matched, the child is automatically removed to avoid duplicate highlights
- **Popup control panel** - Displays current line / total lines, current line text preview, line number jump input, and background/outline color pickers
- **Position memory** - Saves current line index + text content + page URL to session-level memory on toggle-off; restores via text matching (preferred) or index fallback on toggle-on for the same page
- **SPA dynamic content support** - MutationObserver watches DOM changes so asynchronously loaded content in single-page apps is automatically recognized
- **Dual shortcut mechanism** - Manifest commands (globally registered) + content script keydown listener (fallback) ensures reliable response across all page environments
- **Skip empty lines** - Optional feature to automatically skip lines with no text content
- **Custom highlight colors** - Background and outline colors are freely adjustable via color pickers, with settings auto-persisted

---

## Supported Content Types

| Scenario | Support | Matching Method |
|----------|---------|-----------------|
| Web Markdown (GitHub / Yuque / Obsidian, etc.) | Full | Markdown renderer container selectors |
| PDF.js-rendered PDFs (online PDF preview) | Full | PDF.js text layer `.textLayer span` |
| GitHub code files / Diff views | Full | `.js-file-line`, `.blob-code-inner`, etc. |
| Generic web articles (blogs, wikis, tech docs) | Full | `article`, `main`, `.post-content`, `.article-content`, etc. |
| Code blocks (Twoslash / generic) | Full | `div.line`, `.code-line` and other code line container selectors |
| Tables, lists, definition lists | Full | `td`, `dt`, `dd`, `li`, etc. |
| Generic paragraphs and headings | Full | `p`, `h1`-`h6`, `blockquote` and other fallback selectors |
| Chrome built-in PDF viewer | Not supported | Sandbox-isolated; use PDF.js preview instead |
| Local .docx files | Not supported | Must be converted to online preview or HTML first |

---

## Installation

### Chrome / Edge

1. Open `chrome://extensions` (or `edge://extensions` for Edge)
2. Enable "Developer mode" in the top-right corner
3. Click "Load unpacked"
4. Select the `doc-line-highlight` folder from this project

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file in the project

---

## Usage

1. **Enable highlight mode** - Press `Ctrl+Shift+L` on any web page, or click the toolbar icon then click "Enable"
2. **Navigate lines** - `Ctrl+Down` to jump to the next line, `Ctrl+Up` to jump to the previous line
3. **Auto-center** - The current line is highlighted while the page auto-scrolls to center it
4. **Line number jump** - Enter a line number in the Popup panel to jump directly to that line
5. **Customize colors** - Adjust highlight background and outline colors via color pickers in the Popup panel
6. **Position restore** - When re-opening the same page, the last position is automatically restored

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Down` | Highlight next line |
| `Ctrl + Up` | Highlight previous line |
| `Ctrl + Shift + L` | Toggle highlight mode on/off |

Shortcuts can be customized at `chrome://extensions/shortcuts`.

---

## Architecture

```
Manifest V3 (Chrome Extension)
├── Background Service Worker  — Forwards manifest commands to content script
├── Content Scripts
│   ├── content.js             — Core engine (line collection, highlighting, shortcuts, position memory)
│   └── style.css              — Highlight styles (.dlh-highlight class + CSS variable-driven colors)
└── Popup                      — Control panel (status display, line jump, color settings)
```

### Permissions

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access the content of the active tab |
| `storage` | Store user settings (highlight colors, etc.) |

---

## Technical Details

### Line Collection Algorithm

1. Query all potential text elements using 30+ CSS selectors via `querySelectorAll`
2. Deduplicate results with a `Set` (prevents the same element from being matched by multiple selectors)
3. Sort by `compareDocumentPosition` to ensure reading order matches document order
4. **Parent-child dedup**: traverse the sorted list and remove child elements when both parent and child are present
5. Filter out empty text and invisible elements to avoid highlighting content-less lines

### Dual Shortcut Mechanism

- **Manifest commands** - Globally registered commands in `manifest.json`, dispatched by the browser with higher priority
- **Content keydown listener** - Direct keyboard event listener in the content script as a fallback, ensuring response even when commands fail on certain pages (e.g., PDF.js)

### Position Memory

- On toggle-off, saves `current line index + current line text + page URL` to session-level memory variables
- On toggle-on for the same page, restores position via text content matching (precise), falling back to index-based positioning (approximate) if text matching fails
- Memory is automatically cleared when the page is closed or the browser is restarted

### Dynamic Content Adaptation

- Uses `MutationObserver` to watch the DOM tree for changes
- Automatically re-collects the line list when new or removed text elements are detected
- Also triggers a full line list refresh every 10 navigation operations

### Styling Approach

- Highlighting is implemented by adding a `.dlh-highlight` CSS class
- Colors are controlled by CSS custom properties `--dlh-bg` (background) and `--dlh-outline` (outline)
- Color changes from the Popup panel directly update CSS variable values — no stylesheet reload needed

---

## Project Structure

```
doc-line-highlight/
├── manifest.json              # Extension configuration (Manifest V3)
├── background/
│   └── background.js          # Background service (commands forwarding relay)
├── content/
│   ├── content.js             # Core engine (line collection + highlighting + shortcuts + position memory)
│   └── style.css              # Highlight styles (CSS variable-driven)
├── popup/
│   ├── popup.html             # Control panel UI
│   └── popup.js               # Control panel logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md                  # Chinese documentation
└── README_EN.md               # English documentation
```

---

## License

MIT License
