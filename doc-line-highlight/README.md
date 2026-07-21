# Doc Line Highlight - 文档逐行高亮浏览器插件

逐行高亮阅读的浏览器扩展。通过快捷键在页面文本行之间跳转，当前行以黄色背景 + 橙色边框高亮标记并自动滚动居中，适用于网页文章、技术文档、Markdown 页面、PDF.js 渲染的 PDF 等阅读场景。

## 核心功能

- **逐行高亮跳转** - `Ctrl+↓` / `Ctrl+↑` 在页面文本行之间上下移动，当前行高亮显示并自动滚动居中
- **全页面文本识别** - 30+ 个 CSS 选择器覆盖 Markdown、PDF.js、GitHub 代码、通用文章容器、表格、列表等常见文本元素
- **Popup 控制面板** - 显示当前行号 / 总行数、当前行文本预览、行号跳转输入框
- **自定义高亮颜色** - 背景色和边框色均可通过颜色选择器自由调整，设置自动持久化
- **SPA 动态内容适配** - MutationObserver 监听 DOM 变化，单页应用异步加载的内容也能被识别
- **快捷键支持** - `Ctrl+Shift+L` 开关高亮模式，`Esc` 关闭，与 manifest commands 双重保障

## 安装方式

### Chrome / Edge

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目文件夹

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「临时载入附加组件」
3. 选择项目中的 `manifest.json` 文件

## 使用方式

1. 在任意网页上按 `Ctrl+Shift+L` 或点击浏览器工具栏图标后点击「开启」
2. 按 `Ctrl+↓` 跳转到下一行，`Ctrl+↑` 跳转到上一行
3. 当前行会以黄色背景高亮，页面自动滚动使当前行居中
4. Popup 面板可输入行号直接跳转，也可调整高亮颜色

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + ↓` | 高亮下一行 |
| `Ctrl + ↑` | 高亮上一行 |
| `Ctrl + Shift + L` | 开启 / 关闭高亮模式 |

## 适配场景

| 场景 | 支持情况 |
|------|----------|
| 网页 Markdown（GitHub / 语雀 / Obsidian 等） | 完整支持 |
| PDF.js 渲染的 PDF（在线 PDF 预览） | 完整支持 |
| GitHub 代码文件 / Diff 视图 | 完整支持 |
| 通用网页文章（博客、Wiki、技术文档） | 完整支持 |
| Chrome 内置 PDF 阅读器 | 不支持（沙箱隔离，需用 PDF.js 预览） |
| 本地 .docx 文件 | 不支持（需先转为在线预览或 HTML） |

## 技术架构

```
Manifest V3 (Chrome Extension)
├── Background Service Worker  — 转发 manifest commands 到 content script
├── Content Scripts
│   ├── content.js             — 核心引擎（行抓取、高亮、快捷键监听）
│   └── style.css              — 高亮样式（CSS 变量驱动颜色）
└── Popup                      — 控制面板（状态显示、行号跳转、颜色设置）
```

### 关键设计决策

- **选择器 + DOM 排序策略** - 用 30+ 个 CSS 选择器一次查询所有文本元素，按 `compareDocumentPosition` 排序保证阅读顺序，Set 去重避免同一元素被匹配多次
- **父子去重** - 过滤空文本和不可见元素，避免高亮无内容行
- **CSS 变量驱动** - 高亮颜色通过 `--dlh-bg` / `--dlh-outline` 变量注入，用户自定义颜色无需重载 CSS
- **双重快捷键** - manifest commands（全局）+ content script keydown（兜底），确保在各种页面环境下都能响应
- **定时刷新行列表** - 每 10 次导航自动重新抓取 DOM，适配动态加载内容

## 项目结构

```
doc-line-highlight/
├── manifest.json              # 插件配置 (Manifest V3)
├── background/
│   └── background.js          # 后台服务（commands 转发）
├── content/
│   ├── content.js             # 核心引擎（行抓取 + 高亮 + 快捷键）
│   └── style.css              # 高亮样式
├── popup/
│   ├── popup.html             # 控制面板 UI
│   └── popup.js               # 控制面板逻辑
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 许可证

MIT License
