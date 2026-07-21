# Auto Page Turn / 自动翻页

> **Silky-smooth auto-scrolling for desktop browsers — Manifest V3, Chrome & Firefox**
> **桌面浏览器丝滑自动滚动扩展 — Manifest V3，支持 Chrome 与 Firefox**

---

## 目录 / Table of Contents

- [概述 / Overview](#概述--overview)
- [功能特性 / Features](#功能特性--features)
- [安装指南 / Installation](#安装指南--installation)
- [使用方法 / Usage](#使用方法--usage)
- [快捷键 / Keyboard Shortcuts](#快捷键--keyboard-shortcuts)
- [速度档位对照表 / Speed Mapping](#速度档位对照表--speed-mapping)
- [项目结构 / Project Structure](#项目结构--project-structure)
- [架构设计 / Architecture](#架构设计--architecture)
- [技术详解 / Technical Deep Dive](#技术详解--technical-deep-dive)
- [权限说明 / Permissions](#权限说明--permissions)
- [兼容性 / Compatibility](#兼容性--compatibility)
- [常见问题 / Troubleshooting](#常见问题--troubleshooting)

---

## 概述 / Overview

Auto Page Turn 是一款基于 Manifest V3 的桌面浏览器扩展，通过 `requestAnimationFrame` 驱动配合**浮点理想位置追踪**（`idealScrollY`）和**帧率无关时间计算**，在任何刷新率的显示器上实现亚像素级平滑自动滚动。

Auto Page Turn is a Manifest V3 desktop browser extension that delivers sub-pixel smooth auto-scrolling on any display refresh rate, powered by `requestAnimationFrame` with **floating-point ideal position tracking** (`idealScrollY`) and **frame-rate-independent timing**.

---

## 功能特性 / Features

### 核心滚动引擎 / Core Scroll Engine

| 功能 / Feature | 说明 / Description |
|---|---|
| **亚像素平滑滚动** / Sub-pixel Smooth Scrolling | 维护浮点变量 `idealScrollY` 作为滚动位置的权威值，每帧累加浮点增量后调用 `scrollTo()`（浏览器内部处理亚像素渲染），彻底消除旧方案 `Math.floor` + `scrollBy` 导致的整数步进抖动（如速度 1.4 时出现 1-1-2-1-1-2… 的步进模式）。/ Maintains a floating-point `idealScrollY` as the authoritative scroll position. Each frame accumulates a float delta then calls `scrollTo()`, eliminating the integer-stepping jitter of the old `Math.floor` + `scrollBy` approach (e.g. the 1-1-2-1-1-2… pattern at speed 1.4). |
| **帧率无关速度** / Frame-Rate Independent Speed | 速度定义为 `px/frame × 60 = px/s`，再乘以 rAF 时间戳的 `dt` 因子。60Hz / 120Hz / 144Hz 显示器上视觉速度完全一致。/ Speed is defined as `px/frame × 60 = px/s`, then multiplied by the `dt` factor from the rAF timestamp. Visual speed is identical on 60Hz / 120Hz / 144Hz monitors. |
| **标签页切换保护** / Tab-Switch Protection | `dt` 上限 100ms（`Math.min(dt, 0.1)`），防止从后台标签页返回时因 rAF 暂停累积的大时间差导致位置跳变。/ `dt` capped at 100ms (`Math.min(dt, 0.1)`) to prevent position jumps when returning to a background tab after rAF was paused. |
| **双向滚动** / Bidirectional Scrolling | 支持向下和向上两个方向滚动，可通过 Popup 面板或悬浮指示器切换。/ Supports both downward and upward scrolling, switchable from the popup or floating indicator. |
| **边界自动停止** / Auto-Stop at Boundaries | 到达页面底部（`idealScrollY >= maxScroll - 1`）或顶部（`idealScrollY <= 0`）时自动停止滚动。/ Automatically stops when reaching the page bottom (`idealScrollY >= maxScroll - 1`) or top (`idealScrollY <= 0`). |
| **手动滚动检测与重同步** / Manual Scroll Detection & Re-sync | 每帧检测 `|idealScrollY - window.scrollY| > 50px`，超过阈值则判定为用户手动滚动，立即将 `idealScrollY` 同步为当前 `scrollY`。/ Each frame checks `|idealScrollY - window.scrollY| > 50px`; exceeding the threshold triggers re-sync of `idealScrollY` to the current `scrollY`. |

### 用户界面 / User Interface

| 功能 / Feature | 说明 / Description |
|---|---|
| **悬浮药丸指示器** / Floating Pill Indicator | 固定在页面右下角（`bottom: 20px; right: 20px; z-index: 2147483647`）的药丸形浮标，显示方向箭头（↓ / ↑）、状态文字（"向下滚动中" / "向上滚动中"）和速度倍率（如 `×0.4`）。半透明毛玻璃效果（`backdrop-filter: blur(6px)`），点击可切换开关。/ A pill-shaped badge fixed at bottom-right (`bottom: 20px; right: 20px; z-index: 2147483647`), showing direction arrow (↓ / ↑), status text, and speed multiplier (e.g. `×0.4`). Frosted-glass effect (`backdrop-filter: blur(6px)`), click to toggle. |
| **暖白弹出面板** / Warm-Light Popup Panel | 260px 宽白色背景面板，大地色调（`#8a7e6b`, `#f7f3ed`）点缀。包含：启停按钮（运行时变为红色调）、方向切换、速度滑块（10 档）、快捷键提示。/ 260px wide white-background popup with earth-tone accents (`#8a7e6b`, `#f7f3ed`). Includes: start/stop button (turns red when running), direction toggle, speed slider (10 steps), and shortcut hint. |
| **10 档非线性速度滑块** / 10-Step Nonlinear Speed Slider | 滑块位置 1–10 通过手工调校的查找表（`SPEED_MAP`）映射到实际速度 0.1–3.0 px/frame。低速区步进精细（0.1–0.2），高速区步进更大（0.4–0.6），兼顾精确控制和快速翻页。/ Slider positions 1–10 mapped to actual speeds 0.1–3.0 px/frame via a hand-tuned `SPEED_MAP` lookup table. Fine-grained steps at low speeds (0.1–0.2), larger steps at high speeds (0.4–0.6). |

### 系统集成 / System Integration

| 功能 / Feature | 说明 / Description |
|---|---|
| **双路快捷键** / Dual-Path Keyboard Shortcut | `Ctrl+Space`（Mac: `MacCtrl+Space`）切换滚动。同时通过 Chrome `commands` API（manifest 注册）和 content script 页面级 `keydown` 监听器（兜底）双重注册。/ `Ctrl+Space` (Mac: `MacCtrl+Space`) to toggle scrolling. Registered via both Chrome `commands` API (manifest) and a page-level `keydown` listener in the content script (fallback). |
| **智能按键过滤** / Smart Key Filtering | keydown 兜底监听器自动忽略 `<input>`、`<textarea>`、`<select>` 和 `contentEditable` 元素内的按键，不干扰表单输入。/ The keydown fallback ignores events inside `<input>`, `<textarea>`, `<select>`, and `contentEditable` elements to avoid interfering with form input. |
| **设置持久化** / Settings Persistence | 速度（speed）、方向（direction）、平滑标志（smooth）保存在 `chrome.storage.local` 的 `scrollSettings` 键下。页面加载时自动恢复。/ Speed, direction, and smooth flag are persisted in `chrome.storage.local` under the `scrollSettings` key. Automatically restored on page load. |
| **Firefox 兼容** / Firefox Compatibility | 所有脚本使用 `typeof globalThis.browser !== "undefined" ? globalThis.browser : chrome` 命名空间垫片，一套代码同时兼容 Chrome 和 Firefox。manifest 中已注册 `gecko.id: auto-scroll@autoscroller`。/ All scripts use a `browser`/`chrome` namespace shim. Single codebase works on both Chrome and Firefox. Manifest includes `gecko.id: auto-scroll@autoscroller`. |

---

## 安装指南 / Installation

### Chrome / Edge / Opera（Chromium 内核 / Chromium-based）

```
步骤 1  克隆或下载本仓库到本地
步骤 2  地址栏输入 chrome://extensions/（Edge: edge://extensions/）
步骤 3  开启右上角「开发者模式」
步骤 4  点击「加载已解压的扩展程序」
步骤 5  选择 auto-page-turn 目录（包含 manifest.json 的目录）
步骤 6  工具栏出现 ↕ 图标即安装成功，建议固定到工具栏
```

```
Step 1  Clone or download this repository locally
Step 2  Navigate to chrome://extensions/ (Edge: edge://extensions/)
Step 3  Enable "Developer mode" (top-right toggle)
Step 4  Click "Load unpacked"
Step 5  Select the auto-page-turn directory (containing manifest.json)
Step 6  The ↕ icon appears in the toolbar — pin it for quick access
```

### Firefox

```
步骤 1  地址栏输入 about:debugging#/runtime/this-firefox
步骤 2  点击「临时载入附加组件...」
步骤 3  选择 auto-page-turn 目录下的 manifest.json 文件
步骤 4  扩展立即加载（浏览器重启后会失效）
```

```
Step 1  Navigate to about:debugging#/runtime/this-firefox
Step 2  Click "Load Temporary Add-on..."
Step 3  Select manifest.json inside the auto-page-turn directory
Step 4  Extension loads immediately (removed on browser restart — temporary add-on limitation)
```

> **永久安装 Firefox / Permanent Firefox install**：通过 [addons.mozilla.org](https://addons.mozilla.org/) 签名，或使用 `web-ext build` + `web-ext sign` 打包。/ Sign via addons.mozilla.org or use `web-ext build` + `web-ext sign`.

---

## 使用方法 / Usage

```
  ┌──────────────────────────────────────────────────────────┐
  │  1. 点击工具栏 ↕ 图标 → 弹出 Popup 面板                   │
  │     Click the ↕ toolbar icon → popup opens               │
  │                                                          │
  │  2. 拖动速度滑块选择档位（默认档位 3，速度 0.4）            │
  │     Drag the speed slider (default: step 3, speed 0.4)   │
  │                                                          │
  │  3. 选择方向：↓ 向下 或 ↑ 向上                            │
  │     Choose direction: ↓ Down or ↑ Up                     │
  │                                                          │
  │  4. 点击「▶ 开始滚动」或按 Ctrl+Space                      │
  │     Click "▶ Start" or press Ctrl+Space                  │
  │                                                          │
  │  5. 右下角出现悬浮指示器 ↓ 向下滚动中 ×0.4                 │
  │     Floating indicator appears: ↓ Scrolling ×0.4         │
  │     → 点击指示器可暂停/恢复                                │
  │     → Click indicator to pause/resume                    │
  │                                                          │
  │  6. 随时可手动滚动，引擎自动重同步位置                      │
  │     Manual scroll anytime — engine auto-resyncs          │
  │                                                          │
  │  7. 到达页面顶部/底部时自动停止                            │
  │     Auto-stops at page top/bottom                        │
  └──────────────────────────────────────────────────────────┘
```

### Popup 面板控件 / Popup Controls

| 控件 / Control | 功能 / Function |
|---|---|
| **▶ / ⏸ 按钮** | 切换自动滚动。运行时按钮样式变为红色调（`.running`），图标变为 ⏸，文字变为"停止滚动"。/ Toggle auto-scroll. When running, button turns red-tinted (`.running`), icon changes to ⏸, label to "停止滚动". |
| **↓ 向下 / ↑ 向上** | 方向切换按钮组，当前方向以大地色调（`#f7f3ed`）高亮（`.active`）。/ Direction toggle button group; active direction highlighted with earth tone (`#f7f3ed`). |
| **速度滑块（慢 → 快）** | 10 档离散值，当前速度显示在右侧徽标中。/ 10 discrete steps, current speed shown in the badge. |

### 悬浮指示器 / Floating Indicator

```
  滚动激活时右下角出现毛玻璃药丸：
  When scrolling is active, a frosted-glass pill appears at bottom-right:

  ┌──────────────────────────────┐
  │  ↓  向下滚动中      ×0.4    │  ← arrow + status text + speed multiplier
  └──────────────────────────────┘     方向箭头 + 状态文字 + 速度倍率

  样式参数 / Style parameters:
    position: fixed; bottom: 20px; right: 20px;
    z-index: 2147483647;
    border-radius: 16px;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(6px);
    font-size: 12px; padding: 6px 12px;
```

- 悬停 / Hover：透明度从 0.9 升至 1.0 / opacity increases from 0.9 to 1.0
- 点击 / Click：切换滚动开关 / toggles scrolling on/off
- 停止时自动隐藏 / Auto-hidden when scrolling stops

---

## 快捷键 / Keyboard Shortcuts

| 快捷键 / Shortcut | 功能 / Action | 注册方式 / Registration |
|---|---|---|
| `Ctrl+Space` (Win/Linux) | 切换自动滚动 / Toggle auto-scroll | **主路径 / Primary**：Chrome `commands` API（manifest `commands.toggle-scroll`）。**兜底 / Fallback**：content script `keydown` 监听器，自动忽略表单元素内的按键。/ page-level `keydown` listener, ignores form elements. |
| `MacCtrl+Space` (Mac) | 同上 / Same as above | 同上 / Same |

> **为什么需要双路注册？/ Why dual registration?**
> Chrome `commands` API 在 `chrome://`、`edge://` 等内部页面不触发。`keydown` 兜底确保常规网页上始终可用，同时智能忽略 `<input>`、`<textarea>`、`<select>`、`contentEditable` 内的按键，不干扰表单输入。
>
> The Chrome `commands` API does not fire on internal pages (`chrome://`, `edge://`, etc.). The `keydown` fallback ensures the shortcut works on all regular web pages, while intelligently ignoring keystrokes inside form fields.

---

## 速度档位对照表 / Speed Mapping

速度滑块采用**非线性映射**：低速区间隔小（精确控制），高速区间隔大（快速翻页）。

The speed slider uses a **nonlinear mapping**: smaller steps at low speeds (precise control), larger steps at high speeds (fast page-flipping).

```javascript
// popup.js — SPEED_MAP[0] 未使用（滑块从 1 开始 / slider is 1-indexed）
const SPEED_MAP = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0, 1.4, 1.8, 2.4, 3.0];
```

| 档位 / Step | 速度 / Speed (px/frame) | 等效速度 / Effective px/s (@60fps) | 步进 / Delta | 适用场景 / Use Case |
|:---:|:---:|:---:|:---:|---|
| 1 | 0.1 | 6 | — | 极慢·逐行研读 / Ultra-slow: line-by-line study |
| 2 | 0.2 | 12 | +0.1 | 慢速·仔细阅读 / Slow: careful reading |
| **3** | **0.4** | **24** | +0.2 | **默认·舒适阅读 / Default: comfortable reading** |
| 4 | 0.6 | 36 | +0.2 | 中速·随意浏览 / Medium: casual browsing |
| 5 | 0.8 | 48 | +0.2 | 中快·略读 / Medium-fast: skimming |
| 6 | 1.0 | 60 | +0.2 | 标准·正常滚动 / Standard: normal scrolling |
| 7 | 1.4 | 84 | +0.4 | 快速·快速扫描 / Fast: quick scan |
| 8 | 1.8 | 108 | +0.4 | 更快·高速浏览 / Faster: speed browsing |
| 9 | 2.4 | 144 | +0.6 | 极快·翻页 / Very fast: page flipping |
| 10 | 3.0 | 180 | +0.6 | 最大·飞速滚屏 / Maximum: rapid scroll |

> **换算公式 / Conversion formula**：
> `effective_px_per_second = speed × 60`
>
> 任意刷新率下 / For any refresh rate：`delta_per_frame = speed × 60 × dt`
> 其中 `dt = (timestamp - lastTimestamp) / 1000`（秒），上限 0.1s。
> where `dt = (timestamp - lastTimestamp) / 1000` (seconds), capped at 0.1s.

---

## 项目结构 / Project Structure

```
auto-page-turn/
├── manifest.json                 # 扩展清单 / Extension manifest (MV3)
│                                 #   permissions: activeTab, storage
│                                 #   commands: toggle-scroll → Ctrl+Space
│                                 #   content_scripts: <all_urls> @ document_idle
│                                 #   gecko.id: auto-scroll@autoscroller
│
├── background/
│   └── background.js             # Service Worker
│                                 #   · commands API 监听 → 转发 toggle 消息
│                                 #   · commands API listener → forward toggle message
│                                 #   · onInstalled → 写入默认 scrollSettings
│                                 #   · onInstalled → write default scrollSettings
│
├── content/
│   └── content.js                # Content Script（IIFE）
│                                 #   · rAF 滚动引擎（idealScrollY + dt）
│                                 #   · rAF scroll engine (idealScrollY + dt)
│                                 #   · 悬浮指示器 DOM 创建与更新
│                                 #   · Floating indicator DOM creation & update
│                                 #   · 消息监听（8 种 action）
│                                 #   · Message listener (8 action types)
│                                 #   · 页面级 keydown 兜底
│                                 #   · Page-level keydown fallback
│
├── popup/
│   ├── popup.html                # Popup 面板 HTML / Popup panel markup
│   ├── popup.js                  # Popup 交互逻辑 / Popup interaction logic
│   │                             #   · SPEED_MAP 定义与双向转换
│   │                             #   · SPEED_MAP definition & bidirectional conversion
│   │                             #   · UI 状态同步（initState → storage + content）
│   │                             #   · UI state sync (initState → storage + content)
│   │                             #   · 事件绑定（toggle/direction/speed）
│   │                             #   · Event binding (toggle/direction/speed)
│   └── popup.css                 # 暖白主题样式 / Warm-light theme styles
│
├── icons/
│   ├── icon16.png                # 16×16 工具栏图标 / Toolbar icon
│   ├── icon48.png                # 48×48 扩展管理页图标 / Extension manager icon
│   └── icon128.png               # 128×128 安装图标 / Install icon
│
└── README.md                     # 本文件 / This file
```

---

## 架构设计 / Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          manifest.json                              │
│                                                                     │
│  manifest_version: 3                                                │
│  permissions: activeTab, storage                                    │
│  commands: toggle-scroll → Ctrl+Space / MacCtrl+Space               │
│  content_scripts: <all_urls> @ document_idle                        │
│  background: service_worker                                         │
│  gecko.id: auto-scroll@autoscroller                                 │
└───────────────────┬───────────────────────────┬─────────────────────┘
                    │                           │
     ┌──────────────▼────────────┐   ┌──────────▼──────────────────┐
     │  background.js            │   │  content.js (IIFE)          │
     │  (Service Worker)         │   │  (Content Script)           │
     │                           │   │                             │
     │  commands.onCommand ──────┼──▶│  onMessage listener         │
     │   "toggle-scroll"         │   │   ┌───────────────────────┐ │
     │    ↓                      │   │   │ toggle  → toggleScroll│ │
     │  tabs.sendMessage         │   │   │ start   → startScroll │ │
     │   { action: "toggle" }    │   │   │ stop    → stopScroll  │ │
     │                           │   │   │ reverse → reverseDir  │ │
     │  runtime.onInstalled      │   │   │ setSpeed / setDir     │ │
     │   → storage.set defaults  │   │   │ getState (async resp) │ │
     │     speed: 0.4            │   │   │ applySettings         │ │
     │     direction: "down"     │   │   └───────────────────────┘ │
     │     smooth: true          │   │                             │
     └───────────────────────────┘   │  ┌────────────────────────┐ │
                                     │  │ Scroll Engine           │ │
     ┌───────────────────────────┐   │  │                         │ │
     │  popup/                   │   │  │ requestAnimationFrame   │ │
     │  ┌─────────────────────┐  │   │  │  ↓                      │ │
     │  │ popup.html          │  │   │  │ dt = min((now-last)/1k, │ │
     │  │ popup.css           │  │   │  │       0.1)              │ │
     │  │ popup.js            │  │   │  │  ↓                      │ │
     │  │                     │  │   │  │ delta = speed × 60 × dt │ │
     │  │ SPEED_MAP[1..10]    │  │   │  │  ↓                      │ │
     │  │ sliderToSpeed()     │  │   │  │ |ideal-scrollY| > 50?  │ │
     │  │ speedToSlider()     │◀─┼──▶│  │  → re-sync              │ │
     │  │ formatSpeed()       │  │   │  │  ↓                      │ │
     │  │                     │  │   │  │ idealScrollY += delta   │ │
     │  │ initState():        │  │   │  │  ↓                      │ │
     │  │  storage.get ───────┼──┼──▶│  │ clamp [0, maxScroll]    │ │
     │  │  tabs.sendMessage ──┼──┼──▶│  │  ↓                      │ │
     │  │    {getState}       │  │   │  │ scrollTo(0, idealSY)    │ │
     │  │                     │  │   │  │  ↓                      │ │
     │  │ Events:             │  │   │  │ at boundary → stop      │ │
     │  │  toggle / direction │  │   │  │ else → rAF(loop)        │ │
     │  │  speed slider       │  │   │  └────────────────────────┘ │
     │  │  blur → save        │  │   │                             │
     │  └─────────────────────┘  │   │  ┌────────────────────────┐ │
     └─────────────┬─────────────┘   │  │ Floating Indicator      │ │
                   │                 │  │ fixed bottom:20 right:20 │ │
                   │                 │  │ z-index: 2147483647      │ │
                   │                 │  │ backdrop-filter: blur    │ │
                   │                 │  │ click → toggleScroll     │ │
                   │                 │  └────────────────────────┘ │
                   │                 │                             │
                   │                 │  ┌────────────────────────┐ │
                   │                 │  │ keydown Fallback        │ │
                   │                 │  │ Ctrl+Space → toggle     │ │
                   │                 │  │ (ignores form elements) │ │
                   │                 │  └────────────────────────┘ │
                   │                 └─────────────────────────────┘
                   │
          ┌────────▼─────────────┐
          │  chrome.storage.local│
          │                      │
          │  scrollSettings: {   │
          │    speed:     0.4,   │
          │    direction: "down",│
          │    smooth:    true   │
          │  }                   │
          └──────────────────────┘
```

### 消息协议 / Message Protocol

| 消息 / Message | 方向 / Direction | 载荷 / Payload | 用途 / Purpose |
|---|---|---|---|
| `{ action: "toggle" }` | popup / bg → content | — | 切换滚动 / Toggle scrolling |
| `{ action: "start" }` | popup → content | — | 开始滚动 / Start scrolling |
| `{ action: "stop" }` | popup → content | — | 停止滚动 / Stop scrolling |
| `{ action: "reverse" }` | popup → content | — | 翻转方向并持久化 / Flip direction & persist |
| `{ action: "setSpeed", speed: <n> }` | popup → content | `speed: 0.1–3.0` | 更新速度 / Update speed |
| `{ action: "setDirection", direction: <s> }` | popup → content | `"up" \| "down"` | 设置方向 / Set direction |
| `{ action: "getState" }` | popup → content | — | 请求实时状态（异步 `sendResponse`）/ Request live state (async) |
| `{ action: "applySettings", ... }` | popup → content | `speed`, `direction`, `smooth` | 批量应用设置 / Batch-apply settings |

> 除 `getState` 外，所有消息同步返回 `{ isScrolling, speed, direction, smooth }`。`getState` 通过 `return true` 启用异步响应。
>
> All messages synchronously return `{ isScrolling, speed, direction, smooth }` except `getState`, which uses `return true` for async response.

---

## 技术详解 / Technical Deep Dive

### 1. 滚动引擎核心循环 / Scroll Engine Core Loop

```
requestAnimationFrame(scrollStep)
│
├─ 首帧？ ─── 是 ──▶ 记录 lastFrameTime，重新请求 rAF，返回
│  First frame? ─ Yes ──▶ Store lastFrameTime, re-request rAF, return
│
│  否 / No
│  ↓
├─ dt = min((timestamp - lastFrameTime) / 1000, 0.1)
│     帧间隔（秒），上限 100ms 防跳变
│     Frame interval (seconds), capped at 100ms to prevent jumps
│  ↓
├─ delta = speed × 60 × dt
│     帧率无关的每帧位移
│     Frame-rate-independent per-frame displacement
│  ↓
├─ drift = idealScrollY - window.scrollY
│  |drift| > 50px ？
│  ├── 是 ──▶ idealScrollY = window.scrollY  （用户手动滚动，重同步）
│  │           User scrolled manually → re-sync
│  └── 否 ──▶ 继续
│  ↓
├─ idealScrollY += delta (down)  或  -= delta (up)
│  ↓
├─ maxScroll = scrollHeight - innerHeight
│  idealScrollY = clamp(idealScrollY, 0, maxScroll)
│  ↓
├─ window.scrollTo(0, idealScrollY)
│     scrollTo 接受浮点值，浏览器处理亚像素渲染
│     scrollTo accepts floats; browser handles sub-pixel rendering
│  ↓
├─ 到达边界？ / At boundary?
│  ├── (down && idealScrollY >= maxScroll - 1) → stopScroll()
│  ├── (up && idealScrollY <= 0)               → stopScroll()
│  └── 否 → requestAnimationFrame(scrollStep)  // 继续循环
```

### 2. 浮点 idealScrollY 原理 / Why Floating-Point idealScrollY?

**问题 / Problem**：旧方案使用 `Math.floor` 累积整数像素再调用 `scrollBy`。以速度 1.4 为例，每帧增量呈 `1, 1, 2, 1, 1, 2...` 的不均匀模式，在大屏/高 DPI 屏幕上产生明显微抖动。

The old approach accumulated integer pixels via `Math.floor`, then called `scrollBy`. At speed 1.4, increments follow a `1, 1, 2, 1, 1, 2...` pattern, causing visible micro-stuttering on large/high-DPI screens.

**解决方案 / Solution**：`idealScrollY` 是普通浮点数，每帧精确累加位移。`window.scrollTo()` 接受浮点值，浏览器内部处理亚像素渲染，最终呈现完美平滑的运动。

`idealScrollY` is a plain float, accumulating exact sub-pixel displacement each frame. `scrollTo()` accepts floats; the browser handles sub-pixel rendering internally, producing perfectly smooth motion.

### 3. 帧率无关性验证 / Frame-Rate Independence Proof

```
假设 speed = 0.4 px/frame（以 60fps 为基准）
Given speed = 0.4 px/frame (at 60fps baseline)

  60Hz 显示器:
    dt ≈ 16.67ms = 0.01667s
    delta = 0.4 × 60 × 0.01667 ≈ 0.4 px/frame
    60fps × 0.4px = 24 px/s  ✓

  120Hz 显示器:
    dt ≈ 8.33ms = 0.00833s
    delta = 0.4 × 60 × 0.00833 ≈ 0.2 px/frame
    120fps × 0.2px = 24 px/s  ✓  视觉速度相同 / Same visual speed

  144Hz 显示器:
    dt ≈ 6.94ms = 0.00694s
    delta = 0.4 × 60 × 0.00694 ≈ 0.167 px/frame
    144fps × 0.167px = 24 px/s  ✓  视觉速度相同 / Same visual speed
```

### 4. 手动滚动检测 / Manual Scroll Detection

```
每帧检测 / Each frame:

  drift = idealScrollY - window.scrollY

  |drift| > 50px ？
  ├── 是 → 用户主动滚动（滚轮、拖拽、锚点跳转等）
  │         User scrolled (wheel, drag, anchor jump, etc.)
  │         → idealScrollY = window.scrollY  // 立即重同步
  └── 否 → 正常程序化滚动，继续
            Normal programmatic scroll, continue
```

50px 阈值的设计考量 / Threshold rationale:
- **足够大**：忽略 `idealScrollY`（浮点）与 `window.scrollY`（浏览器返回的整数）之间的舍入差异 / Large enough to ignore rounding between `idealScrollY` (float) and `window.scrollY` (integer)
- **足够小**：快速捕捉用户主动滚动操作 / Small enough to catch deliberate user scroll quickly

### 5. 边界自动停止 / Boundary Auto-Stop

```javascript
const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

// 钳位 / Clamp
idealScrollY = Math.max(0, Math.min(idealScrollY, maxScroll));

// 停止条件 / Stop conditions
const atBottom = direction === "down" && idealScrollY >= maxScroll - 1;  // 底部容差 1px
const atTop    = direction === "up"   && idealScrollY <= 0;
```

底部 `-1` 容差处理亚像素舍入。/ The `-1` tolerance handles sub-pixel rounding at the page bottom.

### 6. Firefox 兼容垫片 / Firefox Compatibility Shim

```javascript
// 三处脚本均使用此垫片 / Used in all three scripts
const browser = typeof globalThis.browser !== "undefined"
  ? globalThis.browser   // Firefox
  : chrome;              // Chrome / Edge / Opera
```

Firefox 使用 `browser.*` API 命名空间，Chromium 使用 `chrome.*`。此一行垫片统一接口。manifest 中 `browser_specific_settings.gecko.id` 字段为 Firefox 所必需。

Firefox uses the `browser.*` API namespace; Chromium uses `chrome.*`. This one-liner unifies the interface. The `browser_specific_settings.gecko.id` field in the manifest is required by Firefox.

---

## 权限说明 / Permissions

| 权限 / Permission | 用途 / Purpose |
|---|---|
| `activeTab` | Popup 通过 `chrome.tabs.sendMessage` 与当前标签页的 content script 通信。/ Allows the popup to communicate with the content script via `chrome.tabs.sendMessage`. |
| `storage` | 读写用户设置到 `chrome.storage.local`（键：`scrollSettings`）。/ Read/write user settings to `chrome.storage.local` (key: `scrollSettings`). |

**内容脚本注入 / Content Script Injection**：`content/content.js` 在 `document_idle` 阶段注入所有页面（`<all_urls>`），确保 DOM 就绪后再初始化滚动引擎和指示器。

`content/content.js` is injected into all pages (`<all_urls>`) at `document_idle`, ensuring the DOM is ready before the scroll engine and indicator initialize.

---

## 兼容性 / Compatibility

| 浏览器 / Browser | 最低版本 / Min Version | 状态 / Status | 说明 / Notes |
|---|---|:---:|---|
| Chrome | 88+ | ✓ 完全支持 / Full | Manifest V3 |
| Edge | 88+ | ✓ 完全支持 / Full | 基于 Chromium / Chromium-based |
| Opera | 74+ | ✓ 完全支持 / Full | 基于 Chromium / Chromium-based |
| Firefox | 109+ | ✓ 完全支持 / Full | 通过 `browser`/`chrome` 垫片 + `gecko.id` / Via shim + gecko.id |
| Safari | — | ✗ 不支持 / N/A | 扩展格式不兼容 / Different extension format |

---

## 常见问题 / Troubleshooting

### Ctrl+Space 在部分页面无效 / Shortcut doesn't work on some pages

**原因 / Cause**：Chrome `commands` API 在 `chrome://`、`edge://`、`about:` 页面不触发，`keydown` 兜底也无法覆盖某些捕获键盘事件的页面。/ Chrome `commands` API doesn't fire on `chrome://`, `edge://`, `about:` pages. The keydown fallback also can't override pages that capture keyboard events.

**解决 / Solution**：在这些页面使用 Popup 面板的启停按钮。/ Use the popup's start/stop button on these pages.

### 安装后已打开的页面无响应 / Extension doesn't respond on already-open pages

**原因 / Cause**：Content script 仅注入安装后加载的页面。/ Content scripts are only injected into pages loaded after installation.

**解决 / Solution**：刷新页面（`F5` 或 `Ctrl+R`）。/ Refresh the page (`F5` or `Ctrl+R`).

### 低速滚动时页面有卡顿感 / Jerky scrolling at low speeds on heavy pages

**原因 / Cause**：页面可能包含复杂 CSS（`backdrop-filter`、大型 `box-shadow`）或繁重 JS 导致掉帧。滚动引擎本身是平滑的。/ The page may have heavy CSS (`backdrop-filter`, large `box-shadow`) or JS causing frame drops. The scroll engine itself is smooth.

**解决 / Solution**：提高速度档位，或通过 DevTools 禁用繁重页面元素。/ Increase the speed step, or disable heavy page elements via DevTools.

### 修改手动滚动检测阈值 / Adjusting the manual scroll detection threshold

50px 阈值是 `content.js` 中的固定常量。高级用户可修改：/ The 50px threshold is a constant in `content.js`. Advanced users can adjust:

```javascript
// content.js — scrollStep() 函数内
const drift = idealScrollY - window.scrollY;
if (Math.abs(drift) > 50) {  // ← 修改此值 / Change this value
  idealScrollY = window.scrollY;
}
```
