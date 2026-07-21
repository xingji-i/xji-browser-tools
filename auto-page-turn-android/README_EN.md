# Auto Page Turn - Android Auto-Scroll Extension

A mobile-adapted auto-scrolling browser extension (Manifest V3) designed for Android browsers that support Chrome extensions. Shares the same core scroll engine as the desktop version, with UI and behavior tuned for touch devices.

## Features

- **Smooth Scrolling Engine** -- `requestAnimationFrame` with floating-point `idealScrollY` tracking for sub-pixel precision, identical to the desktop version
- **Frame-Rate Independent Speed** -- `px/frame x 60 x dt` normalization ensures consistent speed across devices with different refresh rates
- **Bidirectional Scrolling** -- Scroll up or down with a single toggle
- **10-Step Non-Linear Speed Slider** -- Ranges from 0.1 to 3.0 px/frame for fine-grained control
- **Auto-Stop at Page Boundaries** -- Detects top/bottom of page and stops automatically
- **Manual Scroll Detection** -- Pauses auto-scroll when user manually scrolls (>100px threshold, raised from 50px on desktop to avoid false triggers from touch inertia)
- **Touch-Optimized Floating Indicator** -- Positioned at `bottom: 80px` to avoid conflict with browser navigation bars; all interactive targets are 44-48px with `touch-action: manipulation`
- **Dynamic Viewport Handling** -- `maxScrollY` recomputed every frame to accommodate mobile viewport quirks (address bar show/hide, orientation changes)
- **Settings Persistence** -- Speed and direction saved via `chrome.storage`

## Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| **Kiwi Browser** | Recommended | Full Chrome extension support; install directly from Chrome Web Store or load unpacked |
| **Yandex Browser** | Supported | Supports Chrome extensions; install via Chrome Web Store |
| **Firefox for Android** | Supported | Install as add-on via addons.mozilla.org or load as temporary add-on |
| Chrome for Android | Not Supported | Does not support browser extensions |
| Samsung Internet | Not Supported | Extension API not available |

## Installation

### Kiwi Browser (Recommended)

**Option A -- Chrome Web Store:**
1. Open Kiwi Browser and navigate to the Chrome Web Store
2. Search for the extension or open the direct link
3. Tap "Add to Chrome"

**Option B -- Load Unpacked:**
1. Transfer the `auto-page-turn-android` directory to your Android device
2. In Kiwi Browser, open `chrome://extensions/`
3. Enable "Developer mode"
4. Tap "+ (from .zip/.crx/user.js)" or use the file picker to load the directory

### Firefox for Android

1. Transfer the extension files to your device
2. Open Firefox for Android and navigate to `about:debugging`
3. Load the extension as a temporary add-on by selecting `manifest.json`
4. For permanent installation, the extension must be signed and hosted on [addons.mozilla.org](https://addons.mozilla.org/)

### Yandex Browser

1. Open Yandex Browser and navigate to the Chrome Web Store
2. Find the extension and tap "Add to Chrome"
3. Alternatively, load the unpacked extension via `browser://extensions/` with Developer mode enabled

## Speed Mapping

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
auto-page-turn-android/
├── manifest.json            # Manifest V3 configuration
├── background/
│   └── background.js        # Service worker: command forwarding + defaults
├── content/
│   └── content.js           # Scroll engine + touch-optimized indicator
├── popup/
│   ├── popup.html           # Control panel (speed slider, direction, start/stop)
│   ├── popup.js             # Popup logic
│   └── popup.css            # Touch-friendly styles
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

**Content Scripts:** Injected on `<all_urls>` at `document_idle`.

## Differences from Desktop Version

| Aspect | Desktop | Android |
|--------|---------|---------|
| Manual scroll threshold | 50px | 100px (accounts for touch inertia) |
| Indicator position | Floating (default top area) | `bottom: 80px` (avoids nav bar) |
| Tap targets | Standard | 44-48px minimum, `touch-action: manipulation` |
| Keyboard shortcuts | `Ctrl+Space` | None (no physical keyboard) |
| Viewport handling | Static `maxScrollY` | Dynamic `maxScrollY` recomputed per frame |
| Popup width | Standard | Touch-optimized layout |
| `browser_specific_settings` | Firefox gecko ID | Firefox gecko ID (separate) |

## Android-Specific Notes

1. **No keyboard shortcuts.** Mobile devices lack a physical keyboard, so all control is through the popup UI and the floating indicator (tap to toggle).

2. **Dynamic viewport.** Android browsers frequently show/hide the address bar and bottom navigation, which changes the visible viewport height. The extension recomputes `maxScrollY` every frame to avoid stopping prematurely or overshooting.

3. **Touch inertia.** Mobile scroll events have momentum/inertia. The 100px manual scroll threshold (vs. 50px on desktop) prevents false pauses caused by residual scroll momentum after a swipe.

4. **Indicator placement.** The floating indicator is positioned at `bottom: 80px` to stay clear of browser chrome (address bar, tab bar, gesture navigation area) that typically occupies the bottom ~60-72px on Android devices.

5. **Background service worker.** Android browsers may aggressively suspend service workers. The extension does not rely on persistent background execution; the service worker only handles initial setup and message forwarding.

## License

MIT License - see individual files for details.
