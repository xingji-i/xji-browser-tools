# AutoTranslate — Bilingual Side-by-Side Translation

> A Manifest V3 Chrome extension that provides paragraph-level bilingual translation using the Azure Translator API, with an elegant side-by-side reading panel and intelligent content extraction.

---

## Table of Contents

- [Features](#features)
- [Azure Translator Setup](#azure-translator-setup)
- [Installation](#installation)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Architecture](#architecture)
- [Settings Reference](#settings-reference)
- [Cache Management](#cache-management)
- [Bilingual UI](#bilingual-ui)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

### Intelligent Content Extraction

AutoTranslate does not blindly translate every DOM node on the page. A **multi-factor scoring algorithm** (`content/extractor.js`) evaluates candidate elements based on text density, DOM position, semantic tag weight, and structural heuristics to identify the actual readable content — articles, documentation, blog posts — while skipping navigation bars, footers, sidebars, and advertisements.

### Paragraph-Level Bilingual Display

Translated text is presented alongside the original in a **Shadow DOM side panel**, preserving the document's paragraph structure. Each source paragraph maps to its translation, enabling natural bilingual reading without leaving the page.

### Resizable Translation Panel

The translation panel can be resized between **300 px and 900 px** by dragging its edge, accommodating everything from quick glances to deep reading sessions.

### Hover Highlight with Source Mapping

Hovering over a translated paragraph card in the panel **highlights the corresponding source paragraph** in the page, and vice versa. This bidirectional visual link makes it trivial to jump between original and translated text.

### Two-Tier Caching

| Tier | Storage | Capacity | Purpose |
|------|---------|----------|---------|
| L1 — Memory | JavaScript `Map` | 5,000 entries | Instant lookups during a session |
| L2 — Persistent | `chrome.storage.local` | 5,000 entries | Survives across browser restarts |

When a translation is requested, L1 is checked first, then L2, and only on a full miss is the API called. Successful responses are written back to both tiers. The cache uses content hashing to detect paragraph-level changes.

### Progressive Rendering

Translations are rendered incrementally as each batch completes, so the reader sees results streaming in rather than waiting for the entire page to finish.

### Batch Translation with Rate-Limiting

The extension groups paragraphs into batches of up to **50 items / 50,000 characters** per API call. A **1-second cooldown** between consecutive calls respects Azure's rate limits. Failed batches are retried with exponential backoff.

### Auto-Translate Option

When enabled, the extension automatically translates every new page without requiring a manual click.

### 10 Supported Languages

| Language | Display Name | Azure Code |
|----------|-------------|------------|
| Chinese (Simplified) | 中文 | `zh-Hans` |
| English | English | `en` |
| Japanese | 日本語 | `ja` |
| Korean | 한국어 | `ko` |
| French | Français | `fr` |
| German | Deutsch | `de` |
| Spanish | Español | `es` |
| Russian | Русский | `ru` |
| Portuguese | Português | `pt` |
| Italian | Italiano | `it` |

> **Note:** Azure Translator uses locale-specific codes. Chinese Simplified maps to `zh-Hans`, not `zh`. The extension handles this mapping internally.

### Dark Mode

The panel and popup UIs follow the system color scheme via `prefers-color-scheme`, with manual override available in settings.

### Draggable FAB with Edge-Snap

A floating action button (FAB) provides one-click access to translation. It can be dragged anywhere on screen and automatically snaps to the nearest edge to stay out of the way.

### API Key Security

The Azure API key is **never exposed to the content script or the page**. All API calls are proxied through the background service worker (`background/service-worker.js`), which injects the key from secure `chrome.storage` before forwarding the request. Content scripts send translation requests to the background via `chrome.runtime.sendMessage`; they never touch the network directly.

---

## Azure Translator Setup

AutoTranslate uses the **Azure Translator** service (endpoint: `api.cognitive.microsofttranslator.com`), not DeepL or Google Translate.

### Step-by-Step

1. **Create an Azure account** at [azure.microsoft.com](https://azure.microsoft.com) if you do not already have one.
2. In the Azure Portal, create a **Translator** resource.
3. Choose the **Free F0 tier** — this provides **2 million characters per month** at no cost.
4. Once the resource is deployed, navigate to **Keys and Endpoint**.
5. Copy **KEY 1** (or KEY 2) and the **Location/Region** (e.g., `eastus`, `westeurope`).
6. Open the extension's **Options page** (right-click the extension icon → Options).
7. Paste the key into the **API Key** field and the region into the **Region** field.
8. Click **Save**. The values are stored as `azureApiKey` and `azureRegion` in `chrome.storage.local`.

### Free Tier Limits

| Metric | Limit |
|--------|-------|
| Characters per month | 2,000,000 |
| Characters per second | 5,000 |
| Concurrent connections | 20 |

The two-tier cache significantly reduces API consumption on repeat visits.

---

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `auto-translate` directory.
5. Configure your Azure API key via the Options page (see above).

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + T` | Toggle the translation panel |
| `Alt + Shift + T` | Translate the current page |

Shortcuts can be customized at `chrome://extensions/shortcuts`.

---

## Architecture

```
auto-translate/
├── manifest.json                  # Manifest V3 configuration
├── background/
│   └── service-worker.js          # API proxy — holds Azure key, forwards requests
├── content/
│   ├── content.js                 # Entry point — FAB creation, controller logic
│   ├── extractor.js               # Multi-factor content scoring & extraction
│   ├── translator.js              # Batch translation manager (50 items / 50K chars)
│   ├── cache.js                   # Two-tier cache (memory Map + chrome.storage)
│   ├── settings.js                # 17 user-configurable settings
│   └── panel.js                   # Shadow DOM translation panel UI
├── popup/
│   ├── popup.html                 # Extension popup
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html               # Full-page options (API key, region, preferences)
│   ├── options.js
│   └── options.css
└── icons/
```

### Key Design Decisions

- **Background service worker as API proxy.** Content scripts cannot be trusted with secrets. The service worker intercepts translation requests, attaches the `Ocp-Apim-Subscription-Key` and `Ocp-Apim-Subscription-Region` headers, and makes the HTTPS call to Azure. The content script only ever sees the translated text.
- **Shadow DOM isolation.** The translation panel is rendered inside a Shadow DOM root, preventing page CSS from affecting the panel layout and vice versa.
- **Manifest V3 permissions.** The extension requests `storage`, `activeTab`, and `scripting`. Host permission is scoped to `api.cognitive.microsofttranslator.com` only.

---

## Settings Reference

The extension exposes **17 configurable settings**, managed through the Options page and persisted in `chrome.storage.local`:

| # | Setting | Type | Default | Description |
|---|---------|------|---------|-------------|
| 1 | `targetLanguage` | string | `zh-Hans` | Target translation language |
| 2 | `autoTranslate` | boolean | `false` | Automatically translate new pages |
| 3 | `panelWidth` | number | `450` | Default panel width in px (300–900) |
| 4 | `darkMode` | string | `auto` | `auto`, `light`, or `dark` |
| 5 | `showHoverHighlight` | boolean | `true` | Enable bidirectional hover highlight |
| 6 | `showFab` | boolean | `true` | Show the floating action button |
| 7 | `fabPosition` | object | `{right:20,bottom:20}` | FAB position (edge-snap enabled) |
| 8 | `cacheEnabled` | boolean | `true` | Enable two-tier translation cache |
| 9 | `cacheMaxEntries` | number | `5000` | Maximum entries per cache tier |
| 10 | `batchSize` | number | `50` | Max paragraphs per API call |
| 11 | `batchCharLimit` | number | `50000` | Max characters per API call |
| 12 | `rateLimitMs` | number | `1000` | Cooldown between API calls (ms) |
| 13 | `retryCount` | number | `2` | Retry attempts on batch failure |
| 14 | `fontSize` | number | `14` | Panel text font size (px) |
| 15 | `progressiveRender` | boolean | `true` | Render results as batches complete |
| 16 | `azureApiKey` | string | `""` | Azure Translator subscription key |
| 17 | `azureRegion` | string | `""` | Azure resource region |

---

## Cache Management

### How It Works

1. On a translation request, the cache key is computed as a hash of the source text + target language.
2. **L1 (Memory Map)** is checked first — O(1) lookup, fastest path.
3. On L1 miss, **L2 (chrome.storage.local)** is queried asynchronously.
4. On L2 miss, the API is called. The result is written to both L1 and L2.
5. When a tier exceeds `cacheMaxEntries` (default 5,000), the oldest entries are evicted (LRU).

### Manual Cache Clear

- Open the Options page and click **Clear Translation Cache** to purge both tiers.
- Alternatively, the popup provides a quick **Clear Cache** button for the current session (L1 only).

---

## Bilingual UI

The extension's own UI (panel, popup, options page) is presented in **both English and Chinese**, reflecting its purpose as a bilingual reading tool. Interface labels, tooltips, and status messages adapt to the user's selected language.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Translation failed" toast on every page | Invalid or missing API key | Re-enter key and region on the Options page |
| 401 / 403 errors in console | Key does not match region | Ensure `azureRegion` matches the resource location exactly (e.g., `eastus`, not `East US`) |
| Free tier quota exhausted | >2M chars translated this month | Check usage in Azure Portal → Translator → Metrics; wait for quota reset or upgrade |
| Panel shows blank | Page has no extractable content | The extractor may not recognize the page layout; try selecting text manually first |
| Cache returns stale translations | Source text changed | Clear the cache from Options or popup |

---

## License

This project is provided as-is for personal and educational use. See the [LICENSE](../LICENSE) file in the repository root for details.
