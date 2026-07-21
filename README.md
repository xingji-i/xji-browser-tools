# xji-browser-tools

个人浏览器扩展工具集，专注于提升网页阅读体验。所有扩展均采用 Manifest V3 规范，纯原生 JavaScript 实现，无框架依赖，无需构建工具。

**仓库地址**：[https://github.com/xingji-i/xji-browser-tools](https://github.com/xingji-i/xji-browser-tools)

---

## 目录

- [扩展一览](#扩展一览)
- [详细说明](#详细说明)
- [快速开始](#快速开始)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [许可证](#许可证)
- [作者](#作者)

---

## 扩展一览

| 扩展名称 | 中文名 | 一句话描述 | 核心特性 |
|---------|--------|-----------|---------|
| [auto-page-turn](./auto-page-turn/) | 自动翻页 | 桌面端自动滚动阅读 | rAF 动画引擎、速度控制、键盘快捷键 |
| [auto-page-turn-android](./auto-page-turn-android/) | 自动翻页 Android 版 | 移动端自动滚动阅读 | 适配 Kiwi/Yandex/Firefox Android |
| [auto-page-turn-mobile](./auto-page-turn-mobile/) | 自动翻页 iOS 版 | iOS Safari 自动滚动 | Safari MV3 兼容、触控优化 |
| [auto-translate](./auto-translate/) | 双语对照翻译 | Azure 驱动的智能双语段落对照翻译 | 智能内容提取、Shadow DOM 侧面板、两级缓存 |
| [doc-line-highlight](./doc-line-highlight/) | 文档逐行高亮 | 逐行高亮跳转阅读 | 30+ 选择器、位置记忆、动态内容适配 |
| [highlight-autoread](./highlight-autoread/) | 高亮跟读 | 高亮 + 自动滚动联动阅读 | 逐行高亮与自动翻页结合 |

---

## 详细说明

### auto-page-turn（自动翻页）

桌面端网页自动滚动扩展。使用 `requestAnimationFrame` 实现丝滑的匀速滚动，支持速度调节和键盘快捷键控制，适用于长文章、小说、新闻等连续阅读场景。

### auto-page-turn-android（自动翻页 Android 版）

Android 平台自动滚动扩展，针对移动端浏览器（Kiwi Browser、Yandex Browser、Firefox Android）进行了适配和优化，支持触控操作和移动端 UI 适配。

### auto-page-turn-mobile（自动翻页 iOS 版）

iOS Safari 平台的自动滚动扩展。采用 Safari 兼容的 Manifest V3 规范，针对触控交互优化。代码已完成，Xcode 封装项目待补充。

> **注意**：iOS 版本需要 Mac 电脑通过 Xcode 进行打包安装。

### auto-translate（双语对照翻译）

基于 **Azure Translator** 的智能双语段落对照翻译扩展。通过多因子评分算法自动提取页面正文内容，在 Shadow DOM 隔离的侧面板中逐段展示原文与译文。支持 10 种语言互译、两级翻译缓存、悬停高亮联动等功能。

**关键特性**：
- Azure Translator API（免费层每月 200 万字符）
- 智能内容提取（语义标签 + class/id 模式 + 段落密度评分）
- 可调节侧面板（300px ~ 900px）
- 批量翻译 + 限速 + 指数退避重试
- API Key 安全隔离（Background Service Worker 代理）

### doc-line-highlight（文档逐行高亮）

网页文本逐行高亮阅读扩展。使用 30+ 个 CSS 选择器覆盖 PDF.js、Markdown、GitHub 代码、通用文章等主流内容类型，支持 DOM 顺序排序、父子去重、位置记忆、SPA 动态内容适配。

**关键特性**：
- `Ctrl+Down/Up` 逐行跳转 + 自动滚动居中
- 广泛的文本类型覆盖
- 双重快捷键机制保障可靠性
- 自定义高亮颜色

### highlight-autoread（高亮跟读）

将逐行高亮与自动滚动相结合的组合扩展，提供引导式阅读体验。在自动滚动的同时逐行高亮当前内容，帮助用户保持阅读专注力。

---

## 快速开始

### Chrome / Edge 安装（开发者模式加载）

1. 克隆或下载本仓库
2. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择想要使用的扩展文件夹（如 `auto-translate/`）

### Firefox 安装（临时加载）

1. 克隆或下载本仓库
2. 打开 `about:debugging#/runtime/this-firefox`
3. 点击「临时载入附加组件」
4. 选择目标扩展文件夹中的 `manifest.json` 文件

> **提示**：Firefox 临时加载的扩展在浏览器重启后会失效。如需持久使用，可将扩展打包为 `.xpi` 文件签名安装。

---

## 技术栈

| 项目 | 说明 |
|------|------|
| 规范 | Manifest V3 |
| 语言 | 纯原生 JavaScript（Vanilla JS），无框架依赖 |
| 构建 | 无构建工具，源码即最终产物，直接加载使用 |
| UI 隔离 | Shadow DOM（auto-translate 侧面板） |
| 兼容性 | Chrome 88+、Edge 88+、Firefox 109+（通过 `browser`/`chrome` 命名空间兼容） |
| 界面语言 | 中文 UI，架构支持 i18n 扩展 |

---

## 项目结构

```
xji-browser-tools/
├── auto-page-turn/            # 自动翻页（桌面端）
├── auto-page-turn-android/    # 自动翻页（Android 版）
├── auto-page-turn-mobile/     # 自动翻页（iOS 版）
├── auto-translate/            # 双语对照翻译
├── doc-line-highlight/        # 文档逐行高亮
├── highlight-autoread/        # 高亮跟读
└── README.md
```

每个扩展都是独立完整的 Chrome Extension，可单独加载使用，互不依赖。

---

## 许可证

本项目采用 [MIT License](./LICENSE) 开源协议。

---

## 作者

**xingji-i** - [GitHub](https://github.com/xingji-i)
