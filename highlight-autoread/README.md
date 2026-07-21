# Highlight AutoRead / 高亮跟读

> **Combined line-highlight + auto-scroll reading extension — Manifest V3, Chrome & Firefox**
> **逐行高亮 + 自动滚动阅读扩展 — Manifest V3，支持 Chrome 与 Firefox**

核心理念 — **高亮跟读**：页面自动逐行推进，高亮当前阅读行并平滑滚动使其始终居中显示，打造沉浸式阅读体验。

Core concept — **Highlight Auto-Read**: the page auto-advances line by line, highlighting the current reading line and smooth-scrolling to keep it centered, creating an immersive reading experience.

---

## 目录 / Table of Contents

- [概述 / Overview](#概述--overview)
- [两种工作模式 / Two Modes](#两种工作模式--two-modes)
- [功能特性 / Features](#功能特性--features)
- [安装指南 / Installation](#安装指南--installation)
- [使用方法 / Usage](#使用方法--usage)
- [快捷键 / Keyboard Shortcuts](#快捷键--keyboard-shortcuts)
- [速度档位对照表 / Speed Mapping](#速度档位对照表--speed-mapping)
- [智能内容检测 / Smart Content Detection](#智能内容检测--smart-content-detection)
- [项目结构 / Project Structure](#项目结构--project-structure)
- [架构设计 / Architecture](#架构设计--architecture)
- [技术详解 / Technical Deep Dive](#技术详解--technical-deep-dive)
- [权限说明 / Permissions](#权限说明--permissions)
- [兼容性 / Compatibility](#兼容性--compatibility)

---

## 概述 / Overview

Highlight AutoRead 是一款融合**自动翻页**（auto-scroll）和**逐行高亮**（line-highlight）两大能力的浏览器扩展。它自动识别页面主体内容区域，将文本拆分为行，然后以可调速度逐行推进——每行高亮的同时平滑滚动页面，让用户始终聚焦于当前阅读行。

Highlight AutoRead is a browser extension that merges **auto-scroll** and **line-highlight** into a unified reading experience. It auto-detects the main content area, splits text into lines, then advances line by line at an adjustable pace — highlighting each line while smooth-scrolling the page to keep the user focused on the current reading position.

---

## 两种工作模式 / Two Modes

### 跟读模式 / Auto-Read Mode

自动逐行推进的沉浸式阅读模式：

Immersive auto-advancing reading mode:

```
  ┌────────────────────────────────────────────────┐
  │  1. 高亮当前行（CSS class + 自定义颜色）         │
  │     Highlight current line (CSS class + color) │
  │                                                │
  │  2. 平滑滚动使当前行居中（scrollIntoView）       │
  │     Smooth-scroll to center current line       │
  │                                                │
  │  3. 等待 dwellSeconds 秒                       │
  │     Wait dwellSeconds                          │
  │                                                │
  │  4. 前进到下一行 → 重复                         │
  │     Advance to next line → repeat              │
  │                                                │
  │  5. 到达末尾时自动停止                          │
  │     Auto-stop at end of content                │
  └────────────────────────────────────────────────┘
```

适合长时间沉浸式阅读，解放双手。/ Ideal for hands-free immersive reading.

### 高亮模式 / Highlight-Only Mode

手动逐行导航模式：

Manual line-by-line navigation mode:

- `Ctrl+Down`：前进到下一行 / Advance to next line
- `Ctrl+Up`：后退到上一行 / Go back to previous line
- 高亮跟随用户操作移动，页面不自动滚动 / Highlight follows user input; page does not auto-scroll

适合精读、反复查看。/ Ideal for careful study and review.

> 两种模式可随时切换，阅读位置自动保存和恢复。
>
> Switch between modes at any time — reading position is automatically saved and restored.

---

## 功能特性 / Features

### 核心能力 / Core Capabilities

| 功能 / Feature | 说明 / Description |
|---|---|
| **高亮跟读** / Highlight Auto-Read | 逐行高亮 + 自动滚动 + 居中，三位一体。/ Line highlight + auto-scroll + centering, all-in-one. |
| **智能内容检测** / Smart Content Detection | 多层级评分算法自动识别主体内容区域，过滤导航栏、侧边栏、广告等。详见[智能内容检测](#智能内容检测--smart-content-detection)。/ Multi-level scoring algorithm auto-detects main content, filtering out nav/sidebar/ads. See [Smart Content Detection](#智能内容检测--smart-content-detection). |
| **30+ CSS 选择器** / 30+ CSS Selectors | `LINE_SELECTORS` 覆盖 PDF.js、GitHub 代码视图、Markdown 渲染、通用文章容器、代码块和兜底选择器。/ Covers PDF.js, GitHub code view, Markdown rendering, generic article containers, code blocks, and fallback selectors. |
| **位置记忆** / Position Memory | 关闭高亮时保存当前行文本（前 80 字符）和索引；重新开启时先文本匹配搜索，失败则按索引回退。/ Saves current line text (first 80 chars) and index on highlight-off; restores via text-match search first, index fallback second. |
| **SPA 支持** / SPA Support | `MutationObserver` 监听 `document.body` 子树变化，300ms 防抖后自动刷新行列表。/ `MutationObserver` watches `document.body` subtree; 300ms debounce then auto-refresh line list. |
| **rAF 滚动检测** / rAF Scroll Detection | 用 `requestAnimationFrame` 位置对比替代 `scroll` 事件监听，彻底避免 `scrollIntoView` 触发 `scroll` 事件导致的误中断。详见[技术详解](#技术详解--technical-deep-dive)。/ Uses rAF position comparison instead of `scroll` event listener to prevent `scrollIntoView` from triggering false manual-scroll detection. See [Technical Deep Dive](#技术详解--technical-deep-dive). |
| **`_programScroll` 保护** / Program Scroll Guard | 执行 `scrollIntoView` 时设置 `_programScroll = true`，1200ms 后重置，期间跳过手动滚动检测。/ Sets `_programScroll = true` during `scrollIntoView`; resets after 1200ms; skips manual scroll detection during this window. |
| **scrollIntoView 回退** / scrollIntoView Fallback | 调用 `scrollIntoView` 后下一帧检查元素是否在视口内；若不在则回退到手动 `scrollTo` 计算。/ After `scrollIntoView`, checks next frame if element is in viewport; falls back to manual `scrollTo` calculation if not. |

### 用户界面 / User Interface

| 功能 / Feature | 说明 / Description |
|---|---|
| **琥珀色主题 Popup** / Amber-Themed Popup | 300px 宽面板，琥珀色渐变头部（`#f5e6c8 → #f0d8a8`），金色强调色（`#d4a843`, `#8a6d00`）。/ 300px wide popup with amber gradient header, gold accent colors. |
| **悬浮指示器** / Floating Indicator | 页面右下角毛玻璃药丸（`backdrop-filter: blur(8px)`），三种状态：跟读中（琥珀色脉冲）、高亮中（金色静态）、已暂停（灰色）。/ Frosted-glass pill at bottom-right. Three states: auto-reading (amber pulse), highlighting (gold static), paused (gray). |
| **行计数器** / Line Counter | 实时显示 `当前行 / 总行数`（如 `42 / 187`）。/ Real-time display of `current / total` (e.g. `42 / 187`). |
| **当前行文本预览** / Current Line Text Preview | Popup 中显示当前高亮行的前 100 字符文本预览。/ Shows first 100 chars of the currently highlighted line in the popup. |
| **跳转到行** / Go-to-Line | 输入行号跳转到指定位置（支持 Enter 键确认）。/ Enter a line number to jump (supports Enter key). |
| **颜色选择器** / Color Pickers | 自定义高亮背景色（默认 `#fff3b0`）和边框色（默认 `#ffb300`），实时生效。/ Customize highlight background (default `#fff3b0`) and outline color (default `#ffb300`), applied in real-time. |
| **内容根显示** / Content Root Display | Popup 显示检测到的主体区域标签（如 `主体区域: <article>`）。/ Shows detected content root tag (e.g. `主体区域: <article>`). |
| **速度滑块** / Speed Slider | 10 档，右侧徽章显示每行停留秒数（如 `5s`）。/ 10 steps, right-side badge shows dwell seconds per line (e.g. `5s`). |

---

## 安装指南 / Installation

### Chrome / Edge / Opera

```
步骤 1  克隆或下载本仓库到本地
步骤 2  地址栏输入 chrome://extensions/
步骤 3  开启「开发者模式」
步骤 4  点击「加载已解压的扩展程序」
步骤 5  选择 highlight-autoread 目录（包含 manifest.json）
步骤 6  工具栏出现扩展图标即成功
```

```
Step 1  Clone or download this repository
Step 2  Navigate to chrome://extensions/
Step 3  Enable "Developer mode"
Step 4  Click "Load unpacked"
Step 5  Select the highlight-autoread directory (containing manifest.json)
Step 6  Extension icon appears in toolbar — done
```

### Firefox

```
步骤 1  地址栏输入 about:debugging#/runtime/this-firefox
步骤 2  点击「临时载入附加组件...」
步骤 3  选择 highlight-autoread/manifest.json
```

```
Step 1  Navigate to about:debugging#/runtime/this-firefox
Step 2  Click "Load Temporary Add-on..."
Step 3  Select highlight-autoread/manifest.json
```

---

## 使用方法 / Usage

```
  ┌──────────────────────────────────────────────────────────┐
  │  1. 点击工具栏扩展图标 → 弹出 Popup 面板                   │
  │     Click toolbar icon → popup opens                     │
  │                                                          │
  │  2. 确认「主体区域」已正确检测（如 <article>）              │
  │     Verify "Content Root" detected correctly (e.g.       │
  │     <article>)                                           │
  │                                                          │
  │  3. 选择模式：                                            │
  │     Choose mode:                                         │
  │                                                          │
  │     ▶ 开始跟读 → 自动逐行高亮+滚动（或 Ctrl+Space）       │
  │     ▶ Start Auto-Read → auto line advance (or Ctrl+Space)│
  │                                                          │
  │     ◆ 高亮 → 仅高亮，手动 Ctrl+↓/↑ 导航                  │
  │     ◆ Highlight → highlight only, manual Ctrl+↓/↑ nav    │
  │                                                          │
  │  4. 调节速度滑块（默认档位 3 → 5s/行）                     │
  │     Adjust speed slider (default: step 3 → 5s/line)      │
  │                                                          │
  │  5. 可选：自定义背景色/边框色                              │
  │     Optional: customize background/outline colors        │
  │                                                          │
  │  6. 右下角出现悬浮指示器：                                 │
  │     Floating indicator at bottom-right:                  │
  │     ▶ 跟读中 42/187 · 5s/行                              │
  │     ◆ 高亮 42/187                                        │
  │     ◇ 已暂停                                             │
  └──────────────────────────────────────────────────────────┘
```

### Popup 面板控件 / Popup Controls

| 控件 / Control | 功能 / Function |
|---|---|
| **▶ 开始跟读 / ⏸ 暂停跟读** | 切换自动跟读模式。运行时变为红色调（`.running`）。/ Toggle auto-read. Turns red when running. |
| **◆ 高亮** | 切换仅高亮模式（不自动滚动）。激活时高亮为金色（`.active`）。/ Toggle highlight-only mode (no auto-scroll). Gold tint when active. |
| **◀ / ▶ 导航按钮** | 上一行 / 下一行（对应 `Ctrl+Up` / `Ctrl+Down`）。/ Previous / next line (maps to `Ctrl+Up` / `Ctrl+Down`). |
| **速度滑块（慢 → 快）** | 10 档，右侧显示每行停留秒数。/ 10 steps, badge shows dwell seconds. |
| **行号显示** | `当前行 / 总行数`（如 `42 / 187`）。/ `current / total` lines. |
| **文本预览** | 当前行前 100 字符。/ First 100 chars of current line. |
| **跳转输入框 + 跳转按钮** | 输入行号，Enter 或点击跳转。/ Enter line number, press Enter or click to jump. |
| **背景色 / 边框色** | `<input type="color">` 颜色选择器，实时生效并持久化。/ Color pickers, applied in real-time and persisted. |

### 悬浮指示器状态 / Floating Indicator States

```
  跟读中 / Auto-reading:
  ┌──────────────────────────────────┐
  │  ▶  跟读中    42/187 · 5s/行    │  ← 琥珀色背景 + 箭头脉冲动画
  └──────────────────────────────────┘     Amber background + arrow pulse

  高亮中 / Highlighting:
  ┌──────────────────────────────────┐
  │  ◆  高亮      42/187            │  ← 淡金色背景
  └──────────────────────────────────┘     Light gold background

  已暂停 / Paused:
  ┌──────────────────────────────────┐
  │  ◇  已暂停                       │  ← 灰色半透明
  └──────────────────────────────────┘     Gray, semi-transparent
```

点击指示器可切换跟读开关。/ Click indicator to toggle auto-read.

---

## 快捷键 / Keyboard Shortcuts

| 快捷键 / Shortcut | 功能 / Action | 注册方式 / Registration |
|---|---|---|
| `Ctrl+Space` (Mac: `MacCtrl+Space`) | 开始 / 暂停自动跟读 / Toggle auto-read | `commands` API (`toggle-autoread`) + keydown 兜底 / + keydown fallback |
| `Ctrl+Down` (Mac: `MacCtrl+Down`) | 高亮下一行 / Highlight next line | `commands` API (`next-line`) + keydown 兜底 / + keydown fallback |
| `Ctrl+Up` (Mac: `MacCtrl+Up`) | 高亮上一行 / Highlight previous line | `commands` API (`prev-line`) + keydown 兜底 / + keydown fallback |
| `Ctrl+Shift+L` (Mac: `MacCtrl+Shift+L`) | 开关高亮模式 / Toggle highlight mode | `commands` API (`toggle-highlight`) + keydown 兜底 / + keydown fallback |

> keydown 兜底监听器使用 `capture: true`（第三个参数），优先级高于页面脚本。自动忽略 `<input>`、`<textarea>`、`<select>`、`contentEditable` 内的按键。
>
> The keydown fallback uses `capture: true` for higher priority than page scripts. Ignores events inside `<input>`, `<textarea>`, `<select>`, `contentEditable`.

---

## 速度档位对照表 / Speed Mapping

跟读模式的速度定义为**每行停留秒数**（dwell seconds），通过 `SPEED_MAP` 非线性映射：

Auto-read speed is defined as **dwell seconds per line**, mapped nonlinearly via `SPEED_MAP`:

```javascript
// content.js / popup.js
const SPEED_MAP = [8, 6, 5, 4, 3, 2.5, 2, 1.5, 1.2, 0.8];
//                 档位1                          档位10
//                 Step 1 (slowest)               Step 10 (fastest)
```

| 档位 / Step | 停留时间 / Dwell (s/line) | 等效速度 / Effective (lines/min) | 适用场景 / Use Case |
|:---:|:---:|:---:|---|
| 1 | 8.0 | 7.5 | 深度精读 / Deep study |
| 2 | 6.0 | 10 | 仔细阅读 / Careful reading |
| **3** | **5.0** | **12** | **默认·认真研读 / Default: study** |
| 4 | 4.0 | 15 | 正常阅读 / Normal reading |
| 5 | 3.0 | 20 | 中速阅读 / Medium pace |
| 6 | 2.5 | 24 | 较快浏览 / Fairly fast |
| 7 | 2.0 | 30 | 快速浏览 / Quick scan |
| 8 | 1.5 | 40 | 速览 / Speed reading |
| 9 | 1.2 | 50 | 快速扫读 / Fast skim |
| 10 | 0.8 | 75 | 极速翻阅 / Ultra-fast |

---

## 智能内容检测 / Smart Content Detection

扩展采用多层级算法自动识别页面主体内容区域。结果缓存在 `_cachedRoot` 中，URL 变化时自动失效。

The extension uses a multi-level algorithm to auto-detect the main content area. Results are cached in `_cachedRoot` and invalidated on URL change.

### 检测流程 / Detection Pipeline

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: 检查缓存                                       │
│  _cachedRoot 存在 && URL 未变 && 仍在 DOM 中？            │
│  ├── 是 → 直接返回缓存                                  │
│  └── 否 → 继续                                         │
│                                                         │
│  Step 2: 语义标签快速匹配                                │
│  Semantic quick match:                                  │
│    article, main, [role="main"],                        │
│    .post-content, .article-content, .entry-content,     │
│    .markdown-body, .post-body, .article-body,           │
│    .content-body, .blog-post, .reader-content           │
│  ├── 命中且 textContent > 100字符 → 返回                 │
│  └── 未命中 → 继续                                      │
│                                                         │
│  Step 3: 候选容器收集                                    │
│  从最多 80 个文本元素（p/h1-h6/li）向上遍历父链           │
│  （最多 6 层），为每个父容器累加引用计数                  │
│  Walk up to 6 parent levels from ≤80 text elements,     │
│  incrementing a reference count for each ancestor       │
│                                                         │
│  Step 4: 过滤非内容区域                                  │
│  Filter non-content:                                    │
│    · 标签: nav, aside, footer, [role="navigation"],     │
│            [role="complementary"], [role="banner"],      │
│            [role="contentinfo"]                          │
│    · class/id 关键词: sidebar, nav, menu, ad-, footer,  │
│            comment, cookie                               │
│                                                         │
│  Step 5: 精细评分（候选数 ≥ 3 且 ≤ 60 个）              │
│  Fine scoring (candidates with count ≥ 3, max 60):     │
│    score = contentChildren × 3                          │
│          + min(log10(textLength) × 6, 25)               │
│          + semanticBonus                                 │
│      (article: +30, main: +25, section: +5,             │
│       [role="main"]: +30)                                │
│                                                         │
│  Step 6: 返回得分最高者（需 > 5 分）                     │
│  Return highest scorer (must exceed 5 points)           │
│  ├── 有 → 缓存并返回                                    │
│  └── 无 → 回退到 document.body                          │
└─────────────────────────────────────────────────────────┘
```

### 评分公式详解 / Scoring Formula Detail

```javascript
// 内容子元素数量（p, h1-h6, li, blockquote, dt, dd, td, pre）
const contentChildren = el.querySelectorAll(CONTENT_CHILD_SELECTOR);
score += contentChildren.length * 3;   // 每子元素 3 分 / 3 pts per child

// 纯文本长度（对数刻度，上限 25 分）
const textLen = el.textContent.trim().length;
score += Math.min(Math.log10(Math.max(textLen, 1)) * 6, 25);
// 示例: 1000字符 → log10(1000)×6 = 18分
//         100字符 → log10(100)×6  = 12分
//        10000字符 → log10(10000)×6 = 24分
//       100000字符 → min(log10×6, 25) = 25分（封顶）

// 语义标签加分
if (tag === 'article')               score += 30;
else if (tag === 'main')             score += 25;
else if (tag === 'section')          score += 5;
if (role === 'main')                 score += 30;
```

### LINE_SELECTORS 完整列表 / Full LINE_SELECTORS List

```javascript
const LINE_SELECTORS = [
  // PDF.js
  '.textLayer span', '.pdfViewer .text-item',
  // GitHub 代码视图 / GitHub code view
  '.js-file-line', '.blob-code-inner',
  // Markdown 渲染 / Markdown rendering
  '.markdown-body p', '.markdown-body li',
  '.markdown-body h1', '.markdown-body h2', '.markdown-body h3',
  '.markdown-body h4', '.markdown-body h5', '.markdown-body h6',
  '.markdown-body blockquote p',
  '.markdown-body .highlight pre code .code-line',
  // 通用文章容器 / Generic article containers
  'article p', 'article li', 'article h1', 'article h2', 'article h3',
  'main p', 'main li',
  '.post-content p', '.post-content li',
  '.article-content p', '.article-content li',
  '.entry-content p', '.entry-content li',
  // 代码块 / Code blocks
  'pre code .code-line',
  // 兜底 / Fallback
  'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'td', 'dt', 'dd'
];
```

行收集后会进行：不可见过滤 → 空内容过滤 → 极短内容过滤（< 3 字符）→ DOM 顺序排序 → 父子去重。

After collection: visibility filter → empty content filter → very-short filter (< 3 chars) → DOM-order sort → parent-child dedup.

---

## 项目结构 / Project Structure

```
highlight-autoread/
├── manifest.json                 # 扩展清单 / Extension manifest (MV3)
│                                 #   permissions: activeTab, storage
│                                 #   commands: toggle-autoread (Ctrl+Space)
│                                 #             next-line (Ctrl+Down)
│                                 #             prev-line (Ctrl+Up)
│                                 #             toggle-highlight (Ctrl+Shift+L)
│                                 #   content_scripts: <all_urls> @ document_idle
│                                 #     js: content/content.js
│                                 #     css: content/style.css
│                                 #   gecko.id: highlight-autoread@autoscroller
│
├── background/
│   └── background.js             # Service Worker
│                                 #   · onInstalled → 写入默认 har_settings
│                                 #   · onInstalled → write default har_settings
│                                 #   · commands.onCommand → 转发 HAR_COMMAND
│                                 #   · commands.onCommand → forward HAR_COMMAND
│
├── content/
│   ├── content.js                # Content Script（IIFE，合并引擎）
│   │                             #   · 智能内容检测（detectContentRoot）
│   │                             #   · Smart content detection
│   │                             #   · 行收集（collectLines, 30+ selectors）
│   │                             #   · Line collection (30+ selectors)
│   │                             #   · 高亮引擎（applyHighlight, CSS 变量）
│   │                             #   · Highlight engine (CSS variables)
│   │                             #   · 自动跟读引擎（scheduleNext, setTimeout）
│   │                             #   · Auto-read engine (setTimeout)
│   │                             #   · rAF 滚动检测（scrollCheckLoop）
│   │                             #   · rAF scroll detection loop
│   │                             #   · scrollIntoView + 回退
│   │                             #   · scrollIntoView + fallback
│   │                             #   · 位置记忆（savedText + savedIndex）
│   │                             #   · Position memory (text + index)
│   │                             #   · MutationObserver（SPA, 300ms 防抖）
│   │                             #   · MutationObserver (SPA, 300ms debounce)
│   │                             #   · 悬浮指示器（三种状态）
│   │                             #   · Floating indicator (3 states)
│   │                             #   · 消息监听（7 种消息类型）
│   │                             #   · Message listener (7 message types)
│   │                             #   · keydown 兜底（capture: true）
│   │                             #   · keydown fallback (capture: true)
│   │
│   └── style.css                 # 页面注入样式 / Injected page styles
│                                 #   · .har-highlight（CSS 变量控制颜色）
│                                 #   · @keyframes har-fadein（淡入动画）
│                                 #   · #har-indicator（指示器样式）
│                                 #   · .har-ind-active（琥珀色脉冲）
│                                 #   · .har-ind-highlight-only（金色静态）
│
├── popup/
│   ├── popup.html                # Popup 面板 HTML（中文界面）
│   │                             #   · SVG 图标标题栏
│   │                             #   · 状态栏 / 主体区域信息
│   │                             #   · 跟读按钮 / 速度滑块
│   │                             #   · 行导航 / 文本预览
│   │                             #   · 跳转输入 / 高亮按钮
│   │                             #   · 颜色选择器 / 快捷键参考
│   ├── popup.js                  # Popup 交互逻辑
│   │                             #   · refreshState() 定时轮询（1s）
│   │                             #   · refreshState() periodic polling (1s)
│   │                             #   · 事件绑定（8 种操作）
│   │                             #   · Event binding (8 operations)
│   └── popup.css                 # 琥珀色主题样式 / Amber theme styles
│
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
└── README.md                     # 本文件 / This file
```

---

## 架构设计 / Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          manifest.json                               │
│                                                                      │
│  MV3 · permissions: activeTab, storage                               │
│  commands: toggle-autoread / next-line / prev-line / toggle-highlight│
│  content_scripts: <all_urls> @ document_idle (JS + CSS)              │
│  gecko.id: highlight-autoread@autoscroller                           │
└──────────────────┬─────────────────────────────┬─────────────────────┘
                   │                             │
    ┌──────────────▼────────────┐  ┌─────────────▼────────────────────┐
    │  background.js            │  │  content.js (IIFE)               │
    │  (Service Worker)         │  │  (Content Script)                │
    │                           │  │                                  │
    │  onInstalled:             │  │  ┌────────────────────────────┐  │
    │   → storage.set defaults  │  │  │ Smart Content Detection    │  │
    │     har_settings: {       │  │  │ detectContentRoot()        │  │
    │       speed: 3,           │  │  │  · 语义快速匹配            │  │
    │       highlightColor:     │  │  │  · Semantic quick match    │  │
    │         "#fff3b0",        │  │  │  · 候选容器评分            │  │
    │       outlineColor:       │  │  │  · Container scoring      │  │
    │         "#ffb300",        │  │  │  · 非内容过滤              │  │
    │       skipEmpty: true,    │  │  │  · Non-content filter     │  │
    │       autoScroll: true    │  │  │  · 精细评分                │  │
    │     }                     │  │  │  · Fine scoring           │  │
    │                           │  │  └────────────────────────────┘  │
    │  commands.onCommand:      │  │                                  │
    │   → tabs.sendMessage      │  │  ┌────────────────────────────┐  │
    │     { type: "HAR_COMMAND",│  │  │ Line Collection            │  │
    │       command: <name> }   │  │  │ collectLines()             │  │
    └───────────────────────────┘  │  │  · 30+ CSS selectors       │  │
                                   │  │  · 可见性/空/短过滤         │  │
    ┌───────────────────────────┐  │  │  · DOM 排序 + 父子去重      │  │
    │  popup/                   │  │  └────────────────────────────┘  │
    │  ┌─────────────────────┐  │  │                                  │
    │  │ popup.html          │  │  │  ┌────────────────────────────┐  │
    │  │ popup.css (amber)   │  │  │  │ Highlight Engine           │  │
    │  │ popup.js            │◀─┼─▶│  │ applyHighlight(index)      │  │
    │  │                     │  │  │  │  · CSS class: .har-highlight│  │
    │  │ refreshState()      │  │  │  │  · CSS vars: --har-bg      │  │
    │  │  every 1000ms       │  │  │  │              --har-outline  │  │
    │  │                     │  │  │  │  · _programScroll = true   │  │
    │  │ Events:             │  │  │  │  · scrollToElement(el)     │  │
    │  │  toggle auto-read   │  │  │  │  · setTimeout 1200ms reset │  │
    │  │  toggle highlight   │  │  │  └────────────────────────────┘  │
    │  │  prev / next line   │  │  │                                  │
    │  │  speed slider       │  │  │  ┌────────────────────────────┐  │
    │  │  go-to-line         │  │  │  │ Auto-Read Engine           │  │
    │  │  color pickers      │  │  │  │ startAutoRead()            │  │
    │  └─────────────────────┘  │  │  │  · scheduleNext()          │  │
    └─────────────┬─────────────┘  │  │  · setTimeout(dwell × 1000)│  │
                  │                │  │  · auto-advance lines      │  │
                  │                │  │ stopAutoRead()             │  │
                  │                │  └────────────────────────────┘  │
                  │                │                                  │
                  │                │  ┌────────────────────────────┐  │
                  │                │  │ rAF Scroll Detection       │  │
                  │                │  │ scrollCheckLoop()          │  │
                  │                │  │  · |currentY - _lastScrollY│  │
                  │                │  │          | > 80px → stop   │  │
                  │                │  │  · skips if _programScroll │  │
                  │                │  │  · rAF loop (always on)    │  │
                  │                │  └────────────────────────────┘  │
                  │                │                                  │
                  │                │  ┌────────────────────────────┐  │
                  │                │  │ Position Memory            │  │
                  │                │  │ savedText (80 chars) +     │  │
                  │                │  │ savedIndex (fallback)      │  │
                  │                │  └────────────────────────────┘  │
                  │                │                                  │
                  │                │  ┌────────────────────────────┐  │
                  │                │  │ MutationObserver           │  │
                  │                │  │ body subtree → 300ms       │  │
                  │                │  │ debounce → refreshLines()  │  │
                  │                │  └────────────────────────────┘  │
                  │                │                                  │
                  │                │  ┌────────────────────────────┐  │
                  │                │  │ Message Listener (7 types) │  │
                  │                │  │ HAR_COMMAND / HAR_GET_STATE│  │
                  │                │  │ HAR_TOGGLE_AUTO/HIGHLIGHT  │  │
                  │                │  │ HAR_SET_SPEED/GOTO_LINE    │  │
                  │                │  │ HAR_UPDATE_SETTINGS        │  │
                  │                │  └────────────────────────────┘  │
                  │                │                                  │
                  │                │  ┌────────────────────────────┐  │
                  │                │  │ keydown Fallback           │  │
                  │                │  │ capture: true              │  │
                  │                │  │ Ctrl+Space / Ctrl+↓/↑     │  │
                  │                │  │ Ctrl+Shift+L               │  │
                  │                │  └────────────────────────────┘  │
                  │                └──────────────────────────────────┘
                  │
       ┌──────────▼─────────────┐
       │  chrome.storage.local  │
       │                        │
       │  har_settings: {       │
       │    speed:          3,  │
       │    highlightColor:     │
       │      "#fff3b0",        │
       │    outlineColor:       │
       │      "#ffb300",        │
       │    skipEmpty:    true, │
       │    autoScroll:   true  │
       │  }                     │
       └────────────────────────┘
```

### 消息协议 / Message Protocol

| 消息类型 / Message Type | 方向 / Direction | 载荷 / Payload | 用途 / Purpose |
|---|---|---|---|
| `HAR_COMMAND` | bg → content | `command: "toggle-autoread" \| "next-line" \| "prev-line" \| "toggle-highlight"` | 转发 manifest commands / Forward manifest commands |
| `HAR_GET_STATE` | popup → content | — | 获取完整状态（异步）/ Get full state (async) |
| `HAR_TOGGLE_AUTO` | popup → content | — | 切换自动跟读 / Toggle auto-read |
| `HAR_TOGGLE_HIGHLIGHT` | popup → content | — | 切换高亮模式 / Toggle highlight mode |
| `HAR_SET_SPEED` | popup → content | `speed: 1–10` | 设置速度档位 / Set speed level |
| `HAR_GOTO_LINE` | popup → content | `line: <number>` | 跳转到指定行 / Jump to line |
| `HAR_UPDATE_SETTINGS` | popup → content | `settings: { highlightColor, outlineColor, ... }` | 更新设置 / Update settings |

**HAR_GET_STATE 返回字段 / Response fields**：

```javascript
{
  highlightActive: boolean,   // 高亮是否开启 / Highlight on?
  autoReading: boolean,       // 跟读是否运行 / Auto-reading?
  currentIndex: number,       // 当前行号（1-based）/ Current line (1-based)
  totalLines: number,         // 总行数 / Total lines
  currentText: string,        // 当前行文本（≤100字符）/ Current line text
  speedLevel: number,         // 速度档位 1-10 / Speed level
  dwellSeconds: number,       // 每行停留秒数 / Dwell seconds
  settings: { ... },          // 当前设置 / Current settings
  contentRoot: string         // 主体区域标签（如 "article"）/ Content root tag
}
```

---

## 技术详解 / Technical Deep Dive

### 1. rAF 滚动检测（替代 scroll 事件）/ rAF Scroll Detection (Replaces scroll Event)

**问题 / Problem**：传统方案使用 `scroll` 事件监听检测用户手动滚动。但 `scrollIntoView` 也会触发 `scroll` 事件，导致跟读被自己的滚动操作误中断。

Traditional approaches use `scroll` event listeners to detect user scrolling. But `scrollIntoView` also fires `scroll` events, causing auto-read to be interrupted by its own scrolling.

**解决方案 / Solution**：使用常驻的 `requestAnimationFrame` 循环比较 `window.scrollY` 与 `_lastScrollY`：

Use a persistent rAF loop comparing `window.scrollY` with `_lastScrollY`:

```javascript
function scrollCheckLoop() {
  const currentY = window.scrollY;
  const delta = Math.abs(currentY - _lastScrollY);

  // 仅当非程序滚动 且 位移 > 80px 时判定为手动滚动
  // Only detect manual scroll when NOT program-scrolling AND delta > 80px
  if (!_programScroll && autoReading && delta > 80) {
    stopAutoRead();  // 用户手动滚动 → 暂停跟读 / User scrolled → pause
  }

  // 非程序滚动期间持续更新基准位置
  // Update baseline position when not program-scrolling
  if (!_programScroll) {
    _lastScrollY = currentY;
  }

  requestAnimationFrame(scrollCheckLoop);
}
```

优势 / Advantages：
- 不监听 `scroll` 事件，`scrollIntoView` 不会触发误判 / No `scroll` event listener — `scrollIntoView` can't trigger false positives
- rAF 频率与渲染同步，检测延迟仅一帧 / rAF frequency matches rendering — detection latency is one frame

### 2. `_programScroll` 保护机制 / Program Scroll Guard

```
applyHighlight(index)
  │
  ├── _programScroll = true
  │
  ├── scrollToElement(el)
  │     ├── scrollIntoView({ behavior: 'smooth', block: 'center' })
  │     └── rAF → 检查是否在视口 → 不在则手动 scrollTo
  │
  └── setTimeout(1200ms)
        └── _programScroll = false
```

在 `_programScroll = true` 的 **1200ms** 窗口内（覆盖 smooth scroll 动画时长 800-1200ms），`scrollCheckLoop` 跳过所有位移检测，不会误中断。

During the **1200ms** window when `_programScroll = true` (covering smooth scroll animation duration of 800-1200ms), `scrollCheckLoop` skips all displacement checks — no false interruptions.

### 3. scrollIntoView 回退机制 / scrollIntoView Fallback

部分页面布局下 `scrollIntoView` 可能无法正确定位元素：

On some page layouts, `scrollIntoView` may fail to position the element correctly:

```javascript
function scrollToElement(el) {
  // 方式 1：原生 scrollIntoView / Method 1: Native scrollIntoView
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) { /* ignore */ }

  // 方式 2：延迟一帧检查 + 手动回退 / Method 2: Next-frame check + fallback
  requestAnimationFrame(() => {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;

    // 已在视口内（容差 ±50px）→ 无需操作
    // Already in viewport (±50px tolerance) → no action needed
    if (rect.top > -50 && rect.bottom < vh + 50) return;

    // 手动计算并滚动到居中位置 / Manual center calculation
    const top = rect.top + window.scrollY;
    const targetY = top - vh / 2 + rect.height / 2;
    window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
  });
}
```

### 4. 位置记忆机制 / Position Memory

**保存（关闭高亮时）/ Save (on highlight off)**：

```javascript
savedIndex = currentIndex;                    // 行索引 / Line index
savedText  = lines[currentIndex].textContent.trim();  // 完整文本 / Full text
savedUrl   = location.href;                   // 页面 URL
```

**恢复（开启高亮时）/ Restore (on highlight on)**：

```javascript
if (savedUrl === location.href && savedIndex >= 0) {
  const savedSnippet = savedText.slice(0, 80);  // 取前 80 字符 / First 80 chars

  // 策略 1：文本匹配 / Strategy 1: Text match
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].textContent.trim().slice(0, 80) === savedSnippet) {
      found = i; break;
    }
  }

  // 策略 2：索引回退 / Strategy 2: Index fallback
  if (found === -1 && savedIndex < lines.length) found = savedIndex;
}
```

### 5. 高亮样式实现 / Highlight Style Implementation

通过 CSS 自定义属性（变量）实现运行时颜色自定义：

Runtime color customization via CSS custom properties (variables):

```css
/* style.css — 注入到页面 / Injected into page */
.har-highlight {
  background-color: var(--har-bg, #fff3b0) !important;
  outline: 2px solid var(--har-outline, #ffb300) !important;
  outline-offset: 2px;
  border-radius: 3px;
  transition: background-color 0.2s ease, outline-color 0.2s ease;
  animation: har-fadein 0.25s ease;
}

@keyframes har-fadein {
  from { background-color: transparent; outline-color: transparent; }
  to   { background-color: var(--har-bg, #fff3b0); outline-color: var(--har-outline, #ffb300); }
}
```

```javascript
// content.js — 运行时设置颜色 / Runtime color application
el.style.setProperty('--har-bg', settings.highlightColor);
el.style.setProperty('--har-outline', settings.outlineColor);
```

### 6. 行收集与去重 / Line Collection & Deduplication

```
collectLines():
│
├─ root.querySelectorAll(LINE_SELECTORS)  // 30+ 选择器
│
├─ 遍历每个元素 / For each element:
│   · 去重（Set 检查）/ Deduplicate (Set check)
│   · 过滤 display:none / visibility:hidden
│   · 过滤空内容（settings.skipEmpty）
│   · 过滤 < 3 字符（非 PRE 标签）
│
├─ DOM 顺序排序 / Sort by DOM order:
│   a.compareDocumentPosition(b)
│
└─ 父子去重 / Parent-child dedup:
    若 A.contains(B) → 移除 B（保留父级）
    If A.contains(B) → remove B (keep parent)
```

---

## 权限说明 / Permissions

| 权限 / Permission | 用途 / Purpose |
|---|---|
| `activeTab` | Popup 与当前标签页 content script 通信。/ Popup communicates with content script. |
| `storage` | 持久化设置到 `chrome.storage.local`（键：`har_settings`）。/ Persist settings (key: `har_settings`). |

Content scripts（JS + CSS）在 `document_idle` 阶段注入所有页面（`<all_urls>`）。

Content scripts (JS + CSS) injected into all pages (`<all_urls>`) at `document_idle`.

---

## 兼容性 / Compatibility

| 浏览器 / Browser | 最低版本 / Min Version | 状态 / Status | 说明 / Notes |
|---|---|:---:|---|
| Chrome | 88+ | ✓ 完全支持 / Full | Manifest V3 |
| Edge | 88+ | ✓ 完全支持 / Full | Chromium-based |
| Opera | 74+ | ✓ 完全支持 / Full | Chromium-based |
| Firefox | 109+ | ✓ 完全支持 / Full | Via `browser`/`chrome` shim + `gecko.id` |
| Safari | — | ✗ 不支持 / N/A | Different extension format |

### 网页兼容性注意事项 / Web Page Compatibility Notes

| 场景 / Scenario | 说明 / Description |
|---|---|
| **Shadow DOM** | 使用 Shadow DOM 的组件无法被内容检测算法和行选择器穿透。/ Shadow DOM components can't be detected by the content algorithm or line selectors. |
| **自定义滚动容器** / Custom scroll containers | 使用 `overflow: hidden` 或自定义滚动容器的页面，`scrollIntoView` 回退机制可能无法正确计算位置。/ Pages with `overflow: hidden` or custom scroll containers may cause fallback calculation issues. |
| **SPA 路由切换** / SPA route changes | 依赖 MutationObserver（300ms 防抖）触发重新检测。首次加载后可能需要等待 DOM 稳定。/ Relies on MutationObserver (300ms debounce) for re-detection. May need to wait for DOM to stabilize after initial load. |
| **动态渲染内容** / Dynamically rendered content | 通过 `refreshLines()` 每 15 行自动刷新一次行列表，适配内容动态变化。/ `refreshLines()` auto-refreshes line list every 15 lines to adapt to dynamic content. |
