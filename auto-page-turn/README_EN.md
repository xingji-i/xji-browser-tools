# Auto Page Turn - Desktop Auto-Scroll Extension

A lightweight, smooth auto-scrolling browser extension for Chrome and Firefox (Manifest V3). Provides pixel-perfect scrolling with floating-point tracking, frame-rate independent speed control, and a minimal floating indicator.

## Features

| Feature | Description |
|---------|-------------|
| **Smooth Scrolling** | Uses `requestAnimationFrame` with floating-point `idealScrollY` tracking for sub-pixel smoothness |
| **Frame-Rate Independent** | Speed calculated as `px/frame × 60 × dt`, ensuring consistent behavior across different refresh rates |
| **Bidirectional** | Scroll up or down with a single toggle |
| **Non-Linear Speed Control** | 10-step slider (0.1–3.0 px/frame) for precise speed adjustment |
| **Auto-Stop at Boundaries** | Automatically stops when reaching the top or bottom of the page |
| **Manual Scroll Detection** | Pauses auto-scroll when user manually scrolls (>50px threshold) |
| **Floating Indicator** | Minimal on-screen widget shows current scroll status |
| **Keyboard Shortcut** | `Ctrl+Space` to toggle auto-scroll |
| **Settings Persistence** | Speed and direction preferences saved via `chrome.storage` |
| **Firefox Compatible** | Full support for Firefox with unified Manifest V3 codebase |

## Installation

### Chrome / Edge / Brave

1. Clone or download this repository
2. Open `chrome://extensions/` in your browser
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the `auto-page-turn` directory

### Firefox

1. Clone or download this repository
2. Open `about:debugging#/runtime/this-firefox` in Firefox
3. Click "Load Temporary Add-on..."
4. Select the `manifest.json` file from the `auto-page-turn` directory

> **Note:** Firefox temporary add-ons are removed on browser restart. For permanent installation, the extension must be signed via [addons.mozilla.org](https://addons.mozilla.org/developers/).

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Space` | Toggle auto-scroll on/off |

> Keyboard shortcuts are defined via Chrome's `commands` API. On Firefox, the shortcut is registered through the manifest.

## Speed Mapping

The speed slider uses a non-linear mapping to provide fine control at low speeds while allowing faster scrolling when needed:

| Slider Step | Speed (px/frame) | Pixels per Second (approx @ 60fps) |
|-------------|------------------|------------------------------------|
| 1 | 0.1 | 6 |
| 2 | 0.2 | 12 |
| 3 | 0.4 | 24 |
| 4 | 0.6 | 36 |
| 5 | 0.8 | 48 |
| 6 | 1.0 | 60 |
| 7 | 1.4 | 84 |
| 8 | 1.8 | 108 |
| 9 | 2.4 | 144 |
| 10 | 3.0 | 180 |

## Project Structure

```
auto-page-turn/
├── manifest.json          # Manifest V3 configuration
├── background/
│   └── background.js      # Service worker: command forwarding + default settings
├── content/
│   └── content.js         # Scroll engine + floating indicator widget
├── popup/
│   ├── popup.html         # Control panel UI
│   ├── popup.js           # Popup logic (speed/direction/toggle)
│   └── popup.css          # Popup styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Permissions

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access the currently active tab for scroll control |
| `storage` | Persist user settings (speed, direction) |

**Content Scripts:** Injected on `<all_urls>` to enable auto-scroll on any webpage.

## Technical Notes

### Scroll Engine

The core scroll engine runs inside the content script and operates as follows:

1. **Frame Loop:** Uses `requestAnimationFrame` for smooth, vsync-aligned updates.
2. **Sub-Pixel Tracking:** Maintains a floating-point `idealScrollY` value. Only the integer portion is applied via `window.scrollTo()`, while the fractional remainder accumulates across frames. This prevents rounding errors that cause visible jitter at low speeds.
3. **Delta-Time Compensation:** Each frame computes `dt = (timestamp - lastTimestamp) / (1000/60)` to normalize speed regardless of monitor refresh rate (60Hz, 120Hz, 144Hz, etc.).
4. **Boundary Detection:** Checks `scrollY <= 0` (top) and `scrollY >= maxScrollY` (bottom) each frame to auto-stop.
5. **Manual Scroll Interruption:** A `wheel` / `scroll` event listener detects user-initiated scrolling. If the scroll position changes by more than 50px outside the animation loop, auto-scroll pauses automatically.

### Background Service Worker

The background script (`background.js`) handles:
- Forwarding keyboard commands (`Ctrl+Space`) to the active tab's content script
- Initializing default settings on first install via `chrome.storage`

### Indicator Widget

A lightweight floating indicator is injected into the page DOM to display:
- Current scroll direction (up/down arrow)
- Active speed level
- Pause/play status

The indicator uses `position: fixed` and is designed to be unobtrusive.

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 88+ | Full Support |
| Edge | 88+ | Full Support |
| Brave | Latest | Full Support |
| Firefox | 109+ | Full Support |

## License

MIT License - see individual files for details.
