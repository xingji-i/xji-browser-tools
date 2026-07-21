# xji-browser-tools

A personal collection of browser extensions focused on enhancing web reading experience. All extensions are built with **Manifest V3**, pure **vanilla JavaScript**, and require **no frameworks or build tools**. Compatible with both **Chrome** and **Firefox**.

> Repository: [https://github.com/xingji-i/xji-browser-tools](https://github.com/xingji-i/xji-browser-tools)

---

## Extensions

| Extension | Description | Key Features |
|---|---|---|
| **auto-page-turn** | Desktop smooth auto-scrolling | `requestAnimationFrame`-based scroll engine, adjustable speed control, keyboard shortcuts |
| **auto-page-turn-android** | Mobile auto-scrolling for Android | Adapted for Kiwi Browser, Yandex Browser, and Firefox on Android |
| **auto-page-turn-mobile** | Mobile auto-scrolling for iOS / Safari | Safari MV3 compatible, touch-optimized controls, requires Xcode wrapping for deployment |
| **auto-translate** | Bilingual paragraph translation | Powered by Azure Translator, smart content extraction, Shadow DOM translation panel |
| **doc-line-highlight** | Line-by-line reading highlight | Works on web articles, PDFs, and code blocks for focused line-by-line reading |
| **highlight-autoread** | Combined highlight + auto-scroll | Merges line highlighting with automatic scrolling for guided, hands-free reading |

---

## Quick Start

### Chrome (and Chromium-based browsers)

1. Open `chrome://extensions/` in your address bar.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the extension folder (e.g., `auto-page-turn/`).
4. The extension is now installed and ready to use.

### Firefox

1. Open `about:debugging#/runtime/this-firefox` in your address bar.
2. Click **Load Temporary Add-on...**
3. Navigate to the extension folder and select the `manifest.json` file.
4. The extension is now loaded for the current session.

> **Note:** Temporary add-ons in Firefox are removed when the browser closes. For persistent use, consider packaging the extension as a `.xpi` file.

---

## Technology Stack

- **Manifest V3** -- latest Chrome/Firefox extension standard
- **Vanilla JavaScript** -- no React, Vue, webpack, or any build pipeline
- **CSS3** -- styling without preprocessors
- **Azure Translator API** -- used by `auto-translate` for bilingual translation
- **Shadow DOM** -- encapsulated UI rendering in `auto-translate`

---

## Project Structure

```
xji-browser-tools/
├── auto-page-turn/                # Desktop auto-scroll extension
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   ├── popup.js
│   └── ...
├── auto-page-turn-android/        # Android auto-scroll extension
│   ├── manifest.json
│   ├── content.js
│   └── ...
├── auto-page-turn-mobile/         # iOS / Safari auto-scroll extension
│   ├── manifest.json
│   ├── content.js
│   └── ...
├── auto-translate/                # Bilingual translation extension
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   └── ...
├── doc-line-highlight/            # Line-by-line highlight extension
│   ├── manifest.json
│   ├── content.js
│   └── ...
├── highlight-autoread/            # Highlight + auto-scroll extension
│   ├── manifest.json
│   ├── content.js
│   └── ...
└── README_EN.md
```

---

## Bilingual UI

All extensions provide a bilingual interface supporting both **Chinese (简体中文)** and **English**. The language is typically auto-detected from the browser locale or toggled via the extension popup.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Author

**xingji-i**
GitHub: [https://github.com/xingji-i](https://github.com/xingji-i)
