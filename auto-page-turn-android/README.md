# Auto Page Turn Android / 自动翻页（移动端）

> **Silky-smooth auto-scrolling for Android mobile browsers — Manifest V3**
> **Android 移动浏览器丝滑自动滚动扩展 — Manifest V3**

---

## 目录 / Table of Contents

- [概述 / Overview](#概述--overview)
- [兼容性 / Compatibility](#兼容性--compatibility)
- [功能特性 / Features](#功能特性--features)
- [与桌面版的差异 / Differences from Desktop](#与桌面版的差异--differences-from-desktop)
- [安装指南 / Installation](#安装指南--installation)
- [使用方法 / Usage](#使用方法--usage)
- [速度档位对照表 / Speed Mapping](#速度档位对照表--speed-mapping)
- [项目结构 / Project Structure](#项目结构--project-structure)
- [架构设计 / Architecture](#架构设计--architecture)
- [技术详解 / Technical Deep Dive](#技术详解--technical-deep-dive)
- [权限说明 / Permissions](#权限说明--permissions)
- [已知限制 / Known Limitations](#已知限制--known-limitations)

---

## 概述 / Overview

Auto Page Turn Android 是桌面版自动翻页扩展的移动端适配版本。继承完全相同的核心滚动引擎（`requestAnimationFrame` + 浮点 `idealScrollY` + 帧率无关速度），针对触屏交互、Android 动态视口和系统导航栏进行了全面优化。

Auto Page Turn Android is the mobile-adapted version of the desktop auto-scroll extension. It inherits the identical core scroll engine (`requestAnimationFrame` + floating-point `idealScrollY` + frame-rate-independent speed), with comprehensive optimizations for touch interaction, Android dynamic viewport, and system navigation bars.

---

## 兼容性 / Compatibility

| 浏览器 / Browser | 支持状态 / Status | 安装方式 / Install Method | 说明 / Notes |
|---|:---:|---|---|
| **Kiwi Browser** | ✓ 推荐 / Recommended | 开发者模式加载 / Developer mode | 完整 MV3 支持，体验最佳 / Full MV3 support, best experience |
| **Yandex Browser** | ✓ 支持 / Supported | 开发者模式加载 / Developer mode | MV3 扩展支持 / MV3 extension support |
| **Firefox for Android** | ✓ 支持 / Supported | about:debugging 或自定义集合 / about:debugging or custom collection | 通过 `browser`/`chrome` 垫片兼容 / Via browser/chrome shim |
| Chrome for Android | ✗ 不支持 / Not supported | — | **不支持扩展功能** / Does not support extensions |
| Samsung Internet | ✗ 不支持 / Not supported | — | 扩展 API 兼容性不足 / Insufficient extension API support |

> **重要提示 / Important**：Android 版 Chrome 完全不支持浏览器扩展，这不是本扩展的限制。
>
> Chrome for Android does not support browser extensions at all — this is not a limitation of this extension.

---

## 功能特性 / Features

### 核心引擎（与桌面版一致）/ Core Engine (Same as Desktop)

| 功能 / Feature | 说明 / Description |
|---|---|
| **亚像素平滑滚动** / Sub-pixel Smooth Scrolling | 浮点 `idealScrollY` 位置追踪，消除整数步进抖动。/ Floating-point `idealScrollY` tracking eliminates integer-stepping jitter. |
| **帧率无关速度** / Frame-Rate Independent Speed | `speed × 60 × dt` 公式，不同设备刷新率下表现一致。/ `speed × 60 × dt` formula ensures consistent behavior across device refresh rates. |
| **双向滚动** / Bidirectional Scrolling | 向上 / 向下两个方向。/ Scroll up or down. |
| **10 档非线性速度** / 10-Step Nonlinear Speed | `SPEED_MAP = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0, 1.4, 1.8, 2.4, 3.0]`，与桌面版完全一致。/ Same `SPEED_MAP` as desktop. |
| **边界自动停止** / Auto-Stop at Boundaries | 到达页面顶部或底部时自动停止。/ Auto-stops at page top or bottom. |
| **标签页切换保护** / Tab-Switch Protection | `dt` 上限 100ms，防止后台返回跳变。/ `dt` capped at 100ms to prevent jumps. |

### 移动端专属优化 / Mobile-Specific Optimizations

| 功能 / Feature | 说明 / Description |
|---|---|
| **暖白浅色主题** / Warm-Light Theme | Popup 采用白色背景 + 大地色调（`#8a7e6b`, `#f7f3ed`），适合移动端阅读环境。/ White background with earth-tone accents, suited for mobile reading. |
| **导航栏避让** / Navigation Bar Avoidance | 悬浮指示器定位在 `bottom: 80px`（桌面版为 20px），避开 Android 系统底部导航栏（手势条 / 三键导航）。/ Indicator positioned at `bottom: 80px` (vs 20px on desktop) to avoid Android system navigation bar. |
| **触屏惯性容差** / Touch Inertia Tolerance | 手动滚动检测阈值提升至 **100px**（桌面版 50px），适配触屏手势滑动的惯性滚动（momentum scrolling），避免惯性尾迹被误判为用户主动干预。/ Manual scroll detection threshold raised to **100px** (vs 50px on desktop) to accommodate touch momentum scrolling. |
| **触控优化** / Touch Optimization | 所有按钮 `min-height: 44–48px`（符合 WCAG 2.1 触控目标指引），全局 `touch-action: manipulation` 消除 300ms 点击延迟，`-webkit-tap-highlight-color: transparent` 去除蓝色高亮。/ All buttons have `min-height: 44–48px` (WCAG 2.1 touch target), global `touch-action: manipulation` eliminates 300ms tap delay, `-webkit-tap-highlight-color: transparent` removes blue highlight. |
| **触控反馈** / Touch Feedback | 指示器 `touchstart` 时 `scale(0.93)` + `opacity: 1`，`touchend` 恢复，提供即时触觉反馈。/ Indicator scales to 0.93 on `touchstart` for instant tactile feedback. |
| **大尺寸滑块拇指** / Enlarged Slider Thumb | 速度滑块拇指 22×22px（桌面版 14×14px），方便手指拖动。/ Slider thumb 22×22px (vs 14×14px on desktop) for easy finger dragging. |
| **动态视口适配** / Dynamic Viewport Handling | 每帧重新计算 `maxScroll = scrollHeight - innerHeight`，适配 Android 浏览器地址栏动态显示/隐藏导致的 `innerHeight` 变化。/ `maxScroll` recomputed every frame to handle `innerHeight` changes from Android URL bar show/hide. |
| **Webkit 前缀兼容** / Webkit Prefix Compatibility | 指示器样式包含 `-webkit-backdrop-filter`、`-webkit-user-select`、`-webkit-tap-highlight-color` 前缀，确保 Kiwi/Yandex 等 Webkit 内核浏览器正确渲染。/ Indicator styles include `-webkit-` prefixed properties for WebKit-based mobile browsers. |
| **设置持久化** / Settings Persistence | 速度、方向、平滑标志保存在 `chrome.storage.local` 的 `scrollSettings` 键下。/ Speed, direction, smooth persisted in `chrome.storage.local`. |

---

## 与桌面版的差异 / Differences from Desktop

| 差异项 / Difference | 桌面版 / Desktop | 移动端版 / Android | 原因 / Reason |
|---|---|---|---|
| **滚动引擎** / Scroll Engine | rAF + idealScrollY + dt | **完全相同 / Identical** | — |
| **速度映射** / Speed Map | `SPEED_MAP[1..10]` | **完全相同 / Identical** | — |
| **手动滚动阈值** / Manual Scroll Threshold | 50px | **100px** | 触屏惯性滚动 / Touch momentum scrolling |
| **指示器位置** / Indicator Position | `bottom: 20px; right: 20px` | `bottom: 80px; right: 12px` | 避让导航栏 / Avoid nav bar |
| **指示器内边距** / Indicator Padding | `6px 12px` | `12px 18px` | 更大触控面积 / Larger touch area |
| **指示器圆角** / Indicator Radius | `16px` | `28px` | 更大药丸 / Larger pill |
| **指示器字号** / Indicator Font Size | `12px` | `14px` | 移动端可读性 / Mobile readability |
| **触控反馈** / Touch Feedback | 无 / None | `touchstart → scale(0.93)` | 触屏即时反馈 / Touch feedback |
| **按钮最小高度** / Button Min Height | 无限制 / None | `44–48px` | WCAG 触控目标 / WCAG touch target |
| **滑块拇指尺寸** / Slider Thumb | `14×14px` | `22×22px` | 手指操作 / Finger operation |
| **键盘快捷键** / Keyboard Shortcuts | `Ctrl+Space` | **无 / None** | 移动端无 commands API / No commands API on mobile |
| **keydown 兜底** / keydown Fallback | 有 / Yes | **无 / None** | 移动端无物理键盘 / No physical keyboard |
| **commands API** | manifest 注册 | **未注册 / Not registered** | 移动端不支持 / Not supported on mobile |
| **background.js 职责** / Background Role | 命令转发 + 默认设置 | **仅默认设置 / Defaults only** | 无命令需要转发 / No commands to forward |
| **Popup 语言** / Popup Language | 中文 | **英文 / English** | 国际化适配 / Internationalization |
| **Popup 宽度** / Popup Width | `260px` | `280px` | 移动端稍宽 / Slightly wider for mobile |
| **Popup 快捷键提示** / Popup Shortcut Hint | 有 / Yes | **无 / None** | 移动端无快捷键 / No shortcuts on mobile |
| **Webkit 前缀** / Webkit Prefixes | 无 / None | 有 / Yes | Webkit 内核浏览器 / WebKit-based browsers |
| **命名空间垫片变量名** / Shim Variable | `browser` | `ext` | 代码风格差异 / Code style |
| **Gecko ID** | `auto-scroll@autoscroller` | `auto-scroll-android@autoscroller` | 区分扩展 / Distinguish extensions |

---

## 安装指南 / Installation

### Kiwi Browser（推荐 / Recommended）

**方式一：开发者模式 / Method 1: Developer Mode**

```
步骤 1  将扩展目录传输到手机（USB / 云盘 / adb push）
步骤 2  打开 Kiwi → 地址栏输入 chrome://extensions/
步骤 3  开启「Developer mode」
步骤 4  点击「+ (from folder)」或「Load unpacked」
步骤 5  选择 auto-page-turn-android 目录
步骤 6  安装完成
```

```
Step 1  Transfer the extension directory to your phone (USB / cloud / adb push)
Step 2  Open Kiwi → navigate to chrome://extensions/
Step 3  Enable "Developer mode"
Step 4  Tap "+ (from folder)" or "Load unpacked"
Step 5  Select the auto-page-turn-android directory
Step 6  Installation complete
```

**方式二：打包 .crx 安装 / Method 2: Packaged .crx**

```
步骤 1  在桌面 Chrome 中打包扩展生成 .crx 文件
步骤 2  将 .crx 传输到手机
步骤 3  在 Kiwi 中直接打开 .crx 文件安装
```

### Firefox for Android

```
步骤 1  地址栏输入 about:debugging
步骤 2  加载扩展（选择 manifest.json）
```

> **提示 / Tip**：Firefox for Android 正式版的扩展加载限制较多，建议使用 Firefox Nightly 或配置自定义附加组件集合。/ Firefox for Android release version has limited extension loading; consider Firefox Nightly or a custom add-on collection.

### Yandex Browser

```
步骤 1  打开 browser://extensions/
步骤 2  开启开发者模式
步骤 3  加载已解压的扩展程序，选择本目录
```

---

## 使用方法 / Usage

```
  ┌──────────────────────────────────────────────────────────┐
  │  1. 点击浏览器菜单中的扩展图标 → 弹出 Popup 面板           │
  │     Tap extension icon in browser menu → popup opens     │
  │                                                          │
  │  2. 拖动速度滑块选择档位（默认档位 3，速度 0.4）            │
  │     Drag speed slider (default: step 3, speed 0.4)       │
  │                                                          │
  │  3. 选择方向：↓ Down 或 ↑ Up                              │
  │     Choose direction: ↓ Down or ↑ Up                     │
  │                                                          │
  │  4. 点击「▶ Start Scrolling」                             │
  │     Tap "▶ Start Scrolling"                              │
  │                                                          │
  │  5. 屏幕右下偏下出现悬浮指示器（bottom: 80px）              │
  │     Floating indicator appears (bottom: 80px)            │
  │     → 点击指示器可暂停/恢复（带按压缩放反馈）              │
  │     → Tap indicator to pause/resume (with scale feedback)│
  │                                                          │
  │  6. 手动滑动时引擎自动重同步（阈值 100px）                  │
  │     Manual swipe auto-resyncs (100px threshold)          │
  │                                                          │
  │  7. 到达页面顶部/底部时自动停止                            │
  │     Auto-stops at page top/bottom                        │
  └──────────────────────────────────────────────────────────┘
```

> **注意 / Note**：移动端浏览器不支持 `commands` API，**无键盘快捷键**。所有操作通过 Popup 面板和悬浮指示器完成。
>
> Mobile browsers do not support the `commands` API — **no keyboard shortcuts**. All operations are via the popup panel and floating indicator.

### Popup 面板控件 / Popup Controls

| 控件 / Control | 功能 / Function |
|---|---|
| **▶ / ⏸ 按钮** | 切换滚动。运行时变为红色调（`.running`），文字变为 "Stop Scrolling"。/ Toggle scrolling. Turns red-tinted when running, label becomes "Stop Scrolling". |
| **↓ Down / ↑ Up** | 方向切换，当前方向高亮（`.active`）。/ Direction toggle, active direction highlighted. |
| **Speed 滑块（Slow → Fast）** | 10 档离散值，右侧显示当前速度。/ 10 discrete steps, current speed shown on the right. |

---

## 速度档位对照表 / Speed Mapping

与桌面版完全一致的非线性映射：

Identical nonlinear mapping as desktop:

```javascript
// popup.js — SPEED_MAP[0] 未使用 / unused (slider is 1-indexed)
const SPEED_MAP = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0, 1.4, 1.8, 2.4, 3.0];
```

| 档位 / Step | 速度 / Speed (px/frame) | 等效速度 / Effective px/s (@60fps) | 适用场景 / Use Case |
|:---:|:---:|:---:|---|
| 1 | 0.1 | 6 | 极慢·逐行研读 / Ultra-slow |
| 2 | 0.2 | 12 | 慢速·仔细阅读 / Slow |
| **3** | **0.4** | **24** | **默认·舒适阅读 / Default** |
| 4 | 0.6 | 36 | 中速·随意浏览 / Medium |
| 5 | 0.8 | 48 | 中快·略读 / Medium-fast |
| 6 | 1.0 | 60 | 标准·正常滚动 / Standard |
| 7 | 1.4 | 84 | 快速·快速扫描 / Fast |
| 8 | 1.8 | 108 | 更快·高速浏览 / Faster |
| 9 | 2.4 | 144 | 极快·翻页 / Very fast |
| 10 | 3.0 | 180 | 最大·飞速滚屏 / Maximum |

---

## 项目结构 / Project Structure

```
auto-page-turn-android/
├── manifest.json                 # 扩展清单 / Extension manifest (MV3)
│                                 #   permissions: storage, activeTab
│                                 #   无 commands 字段 / No commands field
│                                 #   gecko.id: auto-scroll-android@autoscroller
│
├── background/
│   └── background.js             # Service Worker（精简版）
│                                 #   · 仅处理 onInstalled → 写入默认 scrollSettings
│                                 #   · Only handles onInstalled → write defaults
│                                 #   · 无 commands 监听 / No commands listener
│
├── content/
│   └── content.js                # Content Script（IIFE，移动端适配）
│                                 #   · rAF 滚动引擎（与桌面版一致）
│                                 #   · rAF scroll engine (identical to desktop)
│                                 #   · 悬浮指示器（触控优化，bottom: 80px）
│                                 #   · Floating indicator (touch-optimized)
│                                 #   · 手动滚动阈值 100px
│                                 #   · Manual scroll threshold 100px
│                                 #   · 无 keydown 监听 / No keydown listener
│
├── popup/
│   ├── popup.html                # Popup 面板（英文界面，viewport meta）
│   │                             #   <meta viewport: width=device-width,
│   │                             #     maximum-scale=1.0, user-scalable=no>
│   ├── popup.js                  # Popup 逻辑（与桌面版结构一致）
│   └── popup.css                 # 暖白主题 + 触控优化样式
│                                 #   · 全局 -webkit-tap-highlight-color: transparent
│                                 #   · 按钮 min-height: 44–48px
│                                 #   · touch-action: manipulation
│                                 #   · 滑块拇指 22×22px
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
┌───────────────────────────────────────────────────────────────────┐
│                         manifest.json                             │
│                                                                   │
│  manifest_version: 3                                              │
│  permissions: storage, activeTab                                  │
│  无 commands 字段（移动端不支持）/ No commands (unsupported)        │
│  content_scripts: <all_urls> @ document_idle                      │
│  gecko.id: auto-scroll-android@autoscroller                       │
└──────────────────────┬───────────────────────┬────────────────────┘
                       │                       │
        ┌──────────────▼──────────┐  ┌─────────▼──────────────────┐
        │  background.js          │  │  content.js (IIFE)         │
        │  (Service Worker)       │  │  (Content Script)          │
        │                         │  │                            │
        │  仅 onInstalled:        │  │  命名空间垫片: ext =       │
        │   → storage.set({       │  │   browser || chrome        │
        │       speed: 0.4,       │  │                            │
        │       direction: "down",│  │  ┌──────────────────────┐  │
        │       smooth: true      │  │  │ Scroll Engine        │  │
        │     })                  │  │  │ (与桌面版完全一致)    │  │
        │                         │  │  │ (Identical to desktop)│  │
        │  无 commands 监听       │  │  │                      │  │
        │  No commands listener   │  │  │ idealScrollY         │  │
        └─────────────────────────┘  │  │ speed × 60 × dt      │  │
                                     │  │ dt cap: 0.1s         │  │
        ┌─────────────────────────┐  │  │ 手动阈值: 100px      │  │
        │  popup/                 │  │  └──────────────────────┘  │
        │  ┌───────────────────┐  │  │                            │
        │  │ popup.html        │  │  │  ┌──────────────────────┐  │
        │  │ popup.css         │  │  │  │ Floating Indicator   │  │
        │  │ popup.js          │◀─┼─▶│  │                      │  │
        │  │                   │  │  │  │ bottom: 80px         │  │
        │  │ SPEED_MAP (相同)  │  │  │  │ right: 12px          │  │
        │  │ 英文界面          │  │  │  │ padding: 12px 18px   │  │
        │  │ 无快捷键提示      │  │  │  │ radius: 28px         │  │
        │  │ 触控优化 CSS      │  │  │  │ font-size: 14px      │  │
        │  └───────────────────┘  │  │  │                      │  │
        └────────────┬────────────┘  │  │ 触控反馈:            │  │
                     │               │  │  touchstart→scale(.93)│  │
                     │               │  │  touchend  →scale(1)  │  │
                     │               │  │  click → toggleScroll │  │
                     │               │  └──────────────────────┘  │
                     │               │                            │
                     │               │  ┌──────────────────────┐  │
                     │               │  │ Message Listener     │  │
                     │               │  │ (7 actions, 无reverse)│  │
                     │               │  │ toggle / start / stop │  │
                     │               │  │ setSpeed / setDir     │  │
                     │               │  │ getState / apply      │  │
                     │               │  └──────────────────────┘  │
                     │               │                            │
                     │               │  无 keydown 监听器         │
                     │               │  No keydown listener       │
                     │               └────────────────────────────┘
                     │
          ┌──────────▼─────────────┐
          │  chrome.storage.local  │
          │                        │
          │  scrollSettings: {     │
          │    speed:     0.4,     │
          │    direction: "down",  │
          │    smooth:    true     │
          │  }                     │
          └────────────────────────┘
```

### 消息协议 / Message Protocol

| 消息 / Message | 载荷 / Payload | 与桌面版差异 / vs Desktop |
|---|---|---|
| `{ action: "toggle" }` | — | 相同 / Same |
| `{ action: "start" }` | — | 相同 / Same |
| `{ action: "stop" }` | — | 相同 / Same |
| `{ action: "setSpeed", speed: <n> }` | `0.1–3.0` | 相同 / Same |
| `{ action: "setDirection", direction: <s> }` | `"up" \| "down"` | 相同 / Same |
| `{ action: "getState" }` | — | 相同（异步）/ Same (async) |
| `{ action: "applySettings", ... }` | `speed`, `direction`, `smooth` | 相同 / Same |
| ~~`{ action: "reverse" }`~~ | — | **已移除 / Removed** — 移动端无反转需求 |

---

## 技术详解 / Technical Deep Dive

### 1. 滚动引擎（与桌面版一致）/ Scroll Engine (Identical to Desktop)

```
requestAnimationFrame(scrollStep)
│
├─ 首帧？ → 记录时间戳，重新请求 rAF
│  First frame? → Store timestamp, re-request rAF
│
├─ dt = min((timestamp - lastFrameTime) / 1000, 0.1)
│
├─ delta = speed × 60 × dt
│
├─ drift = idealScrollY - window.scrollY
│  |drift| > 100px → idealScrollY = window.scrollY  // 移动端阈值 100px
│  |drift| > 100px → re-sync (mobile threshold: 100px)
│
├─ idealScrollY += delta (down) 或 -= delta (up)
│
├─ maxScroll = scrollHeight - innerHeight  // 每帧重算，适配动态视口
│  idealScrollY = clamp(0, idealScrollY, maxScroll)  // recomputed every frame
│
├─ window.scrollTo(0, idealScrollY)
│
├─ 到达边界 → stopScroll()
│  At boundary → stopScroll()
│
└─ 否则 → requestAnimationFrame(scrollStep)
```

### 2. 触屏惯性滚动处理 / Touch Momentum Scrolling

移动端手势滑动具有惯性（CSS `-webkit-overflow-scrolling: touch`），滚动停止后 `scrollY` 仍持续变化。将手动检测阈值从桌面版的 50px 提升到 **100px**：

Mobile swipe gestures have momentum (CSS `-webkit-overflow-scrolling: touch`); `scrollY` continues changing after the finger lifts. The detection threshold is raised from 50px (desktop) to **100px**:

```javascript
// content.js — scrollStep() 内
const drift = idealScrollY - window.scrollY;
if (Math.abs(drift) > 100) {   // 桌面版为 50px / Desktop uses 50px
  idealScrollY = window.scrollY;
}
```

- **50px**（桌面版）：鼠标滚轮精确，小阈值即可检测意图 / Mouse wheel is precise; small threshold suffices
- **100px**（移动端）：惯性滚动尾迹可达数百像素，大阈值避免误判 / Momentum tail can span hundreds of pixels; larger threshold avoids false positives

### 3. 动态视口适配 / Dynamic Viewport Handling

Android 浏览器的地址栏在用户滚动时动态显示/隐藏，导致 `window.innerHeight` 变化。引擎每帧重新计算 `maxScroll`：

Android browser URL bar dynamically shows/hides during scrolling, causing `window.innerHeight` to change. The engine recomputes `maxScroll` every frame:

```javascript
// 每帧执行 / Every frame
const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
```

确保地址栏收缩或展开时边界检测仍然准确。/ Ensures boundary detection stays accurate when the URL bar shrinks or expands.

### 4. 导航栏避让 / Navigation Bar Avoidance

Android 系统导航栏（手势条或三键导航）遮挡屏幕底部内容：

Android system navigation bar (gesture bar or 3-button nav) obscures bottom screen content:

```javascript
// 桌面版指示器 / Desktop indicator
Object.assign(indicator.style, {
  bottom: "20px",    // 桌面端无导航栏遮挡 / No nav bar on desktop
  right: "20px"
});

// 移动端指示器 / Mobile indicator
Object.assign(indicator.style, {
  bottom: "80px",    // 高出导航栏 / Above nav bar
  right: "12px"
});
```

### 5. 触控优化 CSS / Touch-Optimized CSS

```css
/* 全局禁用蓝色高亮 / Global: disable blue tap highlight */
* { -webkit-tap-highlight-color: transparent; }

/* 主按钮 / Main button */
.btn-main {
  min-height: 48px;          /* WCAG 触控目标 / WCAG touch target */
  touch-action: manipulation; /* 消除 300ms 延迟 / Kill 300ms delay */
}

/* 方向按钮 / Direction buttons */
.dir-btn {
  min-height: 44px;
  touch-action: manipulation;
}

/* 滑块拇指 / Slider thumb */
input[type="range"]::-webkit-slider-thumb {
  width: 22px; height: 22px;  /* 桌面版 14px / Desktop: 14px */
}

/* 触控反馈 / Touch feedback (content.js) */
// touchstart → scale(0.93), opacity(1)
// touchend   → scale(1),    opacity(0.92)
```

### 6. 命名空间垫片 / Namespace Shim

```javascript
// 移动端使用 ext 变量（桌面版使用 browser）
const ext = typeof browser !== "undefined" ? browser : chrome;
```

Kiwi/Yandex 使用 `chrome.*`，Firefox for Android 使用 `browser.*`。

Kiwi/Yandex use `chrome.*`, Firefox for Android uses `browser.*`.

---

## 权限说明 / Permissions

| 权限 / Permission | 用途 / Purpose |
|---|---|
| `storage` | 持久化用户设置到 `chrome.storage.local`（键：`scrollSettings`）。/ Persist user settings (key: `scrollSettings`). |
| `activeTab` | Popup 通过 `tabs.sendMessage` 与 content script 通信。/ Popup communicates with content script via `tabs.sendMessage`. |

Content scripts 在 `document_idle` 阶段注入所有页面（`<all_urls>`）。

Content scripts injected into all pages (`<all_urls>`) at `document_idle`.

---

## 已知限制 / Known Limitations

| 限制 / Limitation | 说明 / Description | 影响范围 / Scope |
|---|---|---|
| **无键盘快捷键** / No keyboard shortcuts | 移动端浏览器不支持 MV3 `commands` API，manifest 中未注册命令。/ Mobile browsers don't support MV3 `commands` API. | 所有移动浏览器 / All mobile browsers |
| **Chrome for Android 不可用** / Chrome for Android N/A | 该浏览器不支持任何扩展。/ This browser doesn't support any extensions. | Chrome for Android 用户 |
| **Samsung Internet 不兼容** / Samsung Internet incompatible | 扩展 API 支持不完整。/ Insufficient extension API support. | Samsung Internet 用户 |
| **指示器位置固定** / Fixed indicator position | `bottom: 80px` 在不同设备导航栏高度下可能偏高或偏低。/ May be slightly high or low depending on device nav bar height. | 部分设备 / Some devices |
| **Firefox 加载不便** / Firefox loading difficulty | Firefox for Android 正式版对扩展加载限制较多。/ Release version has limited extension loading support. | Firefox 正式版用户 |
| **Popup 展现差异** / Popup display variance | 不同浏览器对扩展 Popup 的展现方式不同，部分需从菜单进入。/ Different browsers handle extension popups differently. | 所有移动浏览器 / All mobile browsers |
| **无 `reverse` 消息** / No `reverse` message | 移动端 content script 不支持方向反转消息（无对应 UI 触发）。/ Content script doesn't handle `reverse` message (no UI trigger). | 内部 API 差异 |
