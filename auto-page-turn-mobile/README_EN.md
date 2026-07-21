# Auto Page Turn - iOS Safari Auto-Scroll Extension

A touch-optimized auto-scrolling extension for Safari on iOS (15.4+) and macOS (12+). Built on Manifest V3 with Safari compatibility in mind. The extension code is ready; wrapping into a distributable iOS/macOS app requires Xcode on a Mac (see [Xcode Wrapping Guide](#xcode-wrapping-guide) below).

## Features

- **Smooth Scrolling Engine** -- `requestAnimationFrame` with floating-point `idealScrollY` tracking for sub-pixel precision
- **Frame-Rate Independent Speed** -- `px/frame x 60 x dt` normalization works correctly on ProMotion displays (up to 120Hz)
- **Bidirectional Scrolling** -- Scroll up or down
- **10-Step Non-Linear Speed Slider** -- 0.1 to 3.0 px/frame
- **Auto-Stop at Page Boundaries** -- Stops at top or bottom of page
- **Manual Scroll Detection** -- Pauses when user swipes (>80px threshold, tuned for iOS scroll physics)
- **Touch-Optimized UI** -- All interactive elements meet the 44px minimum tap target per Apple Human Interface Guidelines; uses `-webkit-` prefixed properties for full Safari compatibility
- **Settings Persistence** -- Speed and direction saved via `browser.storage`

## Safari Compatibility

| Requirement | Detail |
|-------------|--------|
| Minimum iOS | 15.4 |
| Minimum macOS | 12 (Monterey) |
| Manifest Version | V3 |
| Safari strict min version | 15.4 (declared in manifest `browser_specific_settings.safari`) |
| Namespace | Unified `browser` API with `chrome` fallback |

## iOS-Specific Design Decisions

1. **No keyboard shortcuts.** iOS does not support manifest-declared keyboard commands. All control is via the popup sheet and the floating indicator (tap to toggle).

2. **Permissions minimized to `storage` only.** The `activeTab` permission is not declared. Safari on iOS grants content script access through the manifest `matches` field without requiring `activeTab`. This follows Apple's principle of minimal permissions for App Store review.

3. **Background script is minimal.** The background service worker only runs on the `onInstalled` event to initialize default settings. It does not persist between events, which aligns with iOS's aggressive background process management.

4. **`-webkit-` prefixes throughout.** CSS uses `-webkit-backdrop-filter`, `-webkit-user-select`, and other vendor-prefixed properties to ensure correct rendering on Safari.

5. **Popup renders as a sheet.** On iOS Safari, the extension popup appears as a bottom sheet rather than a dropdown menu (standard iOS behavior).

6. **Slider thumb sized for touch.** The speed slider thumb is 24px visual size with a 44px+ touch area, meeting Apple HIG requirements.

## Project Structure

```
auto-page-turn-mobile/
├── manifest.json            # Manifest V3, Safari-compatible
├── background/
│   └── background.js        # onInstalled default initialization only
├── content/
│   └── content.js           # Scroll engine + touch-friendly indicator
├── popup/
│   ├── popup.html           # Touch-optimized control panel (viewport meta)
│   ├── popup.css            # Mobile styles (44px+ tap targets, -webkit- prefixes)
│   └── popup.js             # Popup control logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── CONVERSION.md            # Detailed Safari conversion guide (Chinese)
└── README_EN.md             # This file
```

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Persist user settings (speed, direction) |

No other permissions are requested. The `activeTab` permission used in the desktop and Android versions is intentionally omitted for iOS to minimize the permission surface for App Store review.

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

## Xcode Wrapping Guide

The extension code in this directory is complete and Safari-ready. However, iOS Safari extensions **must be wrapped inside a native iOS app** to be installed or distributed. This requires a Mac with Xcode.

For detailed step-by-step instructions, refer to [`CONVERSION.md`](./CONVERSION.md) (in Chinese). Below is a summary of the process:

### Prerequisites

- **Mac computer** (required -- Windows cannot compile iOS Safari extensions)
- **Xcode 14+** (free from the App Store)
- **Apple Developer account** ($99/year for device testing and App Store distribution)

### Quick Start

```bash
# Point Xcode CLI tools to Xcode.app
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer

# Run the Safari Web Extension Converter
xcrun safari-web-extension-converter ./auto-page-turn-mobile --include-ios
```

The converter generates an Xcode workspace with:
- **Shared (Extension)** target -- the extension source code (files from this directory)
- **macOS App** target -- companion Mac app
- **iOS App** target -- companion iOS app shell

### After Conversion

1. Open the generated `.xcodeproj` or `.xcworkspace` in Xcode
2. Configure signing for both macOS and iOS targets
3. Build and run on a simulator or connected device
4. On iOS: Settings > Safari > Extensions > Enable "Auto Scroll"

### Manual Fixes (rarely needed)

The code in this project is already Safari-adapted:
- The API namespace is unified via `const ext = typeof browser !== "undefined" ? browser : chrome`
- The background script only uses `onInstalled` (no persistent service worker dependency)
- CSS includes all necessary `-webkit-` prefixes

If issues arise after conversion, consult `CONVERSION.md` for troubleshooting steps.

## Known Limitations

| Limitation | Explanation |
|------------|-------------|
| No extension on system pages | iOS Safari extensions cannot run on `settings://` or other internal pages |
| Service worker lifecycle | iOS may terminate the background service worker at any time; this extension does not depend on persistent background execution |
| Popup presentation | On iOS Safari, the popup appears as a bottom sheet, not a dropdown |
| No keyboard commands | `manifest.commands` is not supported on iOS and has been removed from this version's manifest |
| Xcode required for installation | Unlike Chrome/Firefox, Safari extensions cannot be sideloaded without Xcode and an Apple Developer account |
| No App Store listing yet | The extension code is ready, but the Xcode project wrapping and App Store submission have not been completed |

## Differences from Desktop and Android Versions

| Aspect | Desktop | Android | iOS (this) |
|--------|---------|---------|------------|
| Permissions | `activeTab` + `storage` | `activeTab` + `storage` | `storage` only |
| Background script | Commands + defaults | Commands + defaults | `onInstalled` only |
| Keyboard shortcuts | `Ctrl+Space` | None | None |
| Manual scroll threshold | 50px | 100px | 80px |
| Indicator tap target | Standard | 44-48px | 44px+ |
| CSS prefixes | Standard | Standard | `-webkit-` throughout |
| Popup style | Dropdown | Dropdown | Bottom sheet |
| Distribution | Load unpacked / Web Store | Load unpacked / Store | Xcode + App Store |

## License

MIT License - see individual files for details.
