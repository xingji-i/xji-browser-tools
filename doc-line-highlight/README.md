# Doc Line Highlight - 文档逐行高亮

**[English](README_EN.md)** | 中文

Manifest V3 浏览器扩展，实现网页文本的逐行高亮阅读。通过快捷键在页面文本行之间跳转，当前行以自定义颜色的背景 + 边框高亮标记并自动滚动居中，适用于网页文章、技术文档、Markdown 页面、PDF.js 渲染的 PDF、GitHub 代码等阅读场景。

---

## 目录

- [核心功能](#核心功能)
- [支持的内容类型](#支持的内容类型)
- [安装方式](#安装方式)
- [使用方式](#使用方式)
- [快捷键](#快捷键)
- [技术架构](#技术架构)
- [技术细节](#技术细节)
- [项目结构](#项目结构)
- [许可证](#许可证)

---

## 核心功能

- **逐行高亮跳转** - `Ctrl+Down` / `Ctrl+Up` 在页面文本行之间上下移动，当前行高亮显示并自动滚动居中（`scrollIntoView` smooth）
- **广泛的文本识别** - 30+ 个 CSS 选择器覆盖主流阅读场景：PDF.js 文本层、Markdown 渲染器、GitHub 代码视图、通用文章容器、代码块、表格、列表等
- **DOM 顺序排序** - 使用 `compareDocumentPosition` 按文档顺序排列元素，保证阅读顺序与视觉顺序一致
- **父子去重** - 当父元素和子元素同时被匹配时，自动移除子元素，避免重复高亮
- **Popup 控制面板** - 显示当前行号 / 总行数、当前行文本预览、行号跳转输入框、背景色和边框色颜色选择器
- **位置记忆** - 关闭高亮时保存当前行索引 + 文本内容 + 页面 URL（会话级内存变量），同一页面重新开启时通过文本匹配（优先）或索引回退（兜底）恢复位置
- **SPA 动态内容适配** - MutationObserver 监听 DOM 变化，单页应用异步加载的内容也能被自动识别
- **双重快捷键机制** - manifest commands（全局注册）+ content script keydown 监听（兜底），确保在各种页面环境下都能可靠响应
- **跳过空行** - 可选功能，自动跳过无文本内容的空行
- **自定义高亮颜色** - 背景色和边框色均可通过颜色选择器自由调整，设置自动持久化

---

## 支持的内容类型

| 场景 | 支持情况 | 匹配方式 |
|------|---------|---------|
| 网页 Markdown（GitHub / 语雀 / Obsidian 等） | 完整支持 | Markdown 渲染器容器选择器 |
| PDF.js 渲染的 PDF（在线 PDF 预览） | 完整支持 | PDF.js 文本层 `.textLayer span` |
| GitHub 代码文件 / Diff 视图 | 完整支持 | `.js-file-line`、`.blob-code-inner` 等 |
| 通用网页文章（博客、Wiki、技术文档） | 完整支持 | `article`、`main`、`.post-content`、`.article-content` 等 |
| 代码块（Twoslash / 通用） | 完整支持 | `div.line`、`.code-line` 等代码行容器选择器 |
| 表格、列表、定义列表 | 完整支持 | `td`、`dt`、`dd`、`li` 等 |
| 通用段落与标题 | 完整支持 | `p`、`h1`-`h6`、`blockquote` 等兜底选择器 |
| Chrome 内置 PDF 阅读器 | 不支持 | 沙箱隔离，需使用 PDF.js 预览 |
| 本地 .docx 文件 | 不支持 | 需先转为在线预览或 HTML |

---

## 安装方式

### Chrome / Edge

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目的 `doc-line-highlight` 文件夹

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「临时载入附加组件」
3. 选择项目中的 `manifest.json` 文件

---

## 使用方式

1. **开启高亮模式** - 在任意网页上按 `Ctrl+Shift+L`，或点击浏览器工具栏图标后点击「开启」
2. **逐行跳转** - `Ctrl+Down` 跳转到下一行，`Ctrl+Up` 跳转到上一行
3. **自动居中** - 当前行高亮显示的同时，页面自动滚动使当前行居中
4. **行号跳转** - 在 Popup 面板输入行号直接跳转到指定行
5. **自定义颜色** - 在 Popup 面板通过颜色选择器调整高亮的背景色和边框色
6. **位置恢复** - 重新打开同一页面时，自动恢复到上次离开时的位置

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Down` | 高亮下一行 |
| `Ctrl + Up` | 高亮上一行 |
| `Ctrl + Shift + L` | 开启 / 关闭高亮模式 |

---

## 技术架构

```
Manifest V3 (Chrome Extension)
├── Background Service Worker  — 转发 manifest commands 到 content script
├── Content Scripts
│   ├── content.js             — 核心引擎（行抓取、高亮、快捷键监听、位置记忆）
│   └── style.css              — 高亮样式（.dlh-highlight 类 + CSS 变量驱动颜色）
└── Popup                      — 控制面板（状态显示、行号跳转、颜色设置）
```

### 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 访问当前活动标签页的内容 |
| `storage` | 存储用户设置（高亮颜色等） |

---

## 技术细节

### 行收集算法

1. 使用 30+ 个 CSS 选择器通过 `querySelectorAll` 查询所有潜在文本元素
2. 使用 `Set` 对结果去重（避免同一元素被多个选择器匹配）
3. 按 `compareDocumentPosition` 排序，保证阅读顺序与文档顺序一致
4. **父子去重**：遍历排序后的元素列表，当父元素和子元素同时存在时移除子元素
5. 过滤空文本和不可见元素，避免高亮无内容行

### 双重快捷键机制

- **manifest commands** - 在 `manifest.json` 中注册的全局命令，由浏览器统一调度，优先级更高
- **content keydown 监听** - 在 content script 中直接监听键盘事件的兜底方案，确保在某些页面（如 PDF.js）中命令无法触发时仍能响应

### 位置记忆

- 关闭高亮时将 `当前行索引 + 当前行文本 + 页面 URL` 保存到会话级内存变量
- 同一页面重新开启时，优先通过文本内容匹配恢复位置（精确），文本匹配失败时回退到索引定位（近似）
- 页面关闭或浏览器重启后记忆自动清除

### 动态内容适配

- 使用 `MutationObserver` 监听 DOM 树变化
- 检测到新增或移除的文本元素时，自动重新收集行列表
- 每 10 次导航操作也会触发一次完整的行列表刷新

### 样式方案

- 高亮通过添加 `.dlh-highlight` CSS 类实现
- 颜色由 CSS 自定义属性 `--dlh-bg`（背景色）和 `--dlh-outline`（边框色）控制
- 用户通过 Popup 面板修改颜色后直接更新 CSS 变量值，无需重载样式表

---

## 项目结构

```
doc-line-highlight/
├── manifest.json              # 插件配置 (Manifest V3)
├── background/
│   └── background.js          # 后台服务（commands 转发中继）
├── content/
│   ├── content.js             # 核心引擎（行抓取 + 高亮 + 快捷键 + 位置记忆）
│   └── style.css              # 高亮样式（CSS 变量驱动）
├── popup/
│   ├── popup.html             # 控制面板 UI
│   └── popup.js               # 控制面板逻辑
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md                  # 中文文档
└── README_EN.md               # English documentation
```

---

## 许可证

MIT License
