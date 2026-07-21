# AutoTranslate - 双语对照翻译

基于 **Azure Translator** 的智能双语段落对照翻译浏览器扩展（Manifest V3）。自动提取页面正文内容，在可调节宽度的 Shadow DOM 侧面板中逐段展示原文与译文，适用于网页文章、新闻、博客、电子书等阅读场景。

---

## 目录

- [核心功能](#核心功能)
- [安装方式](#安装方式)
- [Azure 翻译服务配置](#azure-翻译服务配置)
- [使用方式](#使用方式)
- [快捷键](#快捷键)
- [设置说明](#设置说明)
- [缓存机制](#缓存机制)
- [技术架构](#技术架构)
- [项目结构](#项目结构)
- [许可证](#许可证)

---

## 核心功能

- **智能内容提取** - 多因子评分算法（语义标签、class/id 模式、段落密度、文本/链接密度）自动定位页面正文，过滤导航栏、广告、侧边栏等噪音内容
- **段落级双语对照** - 原文和译文逐段排列，每张翻译卡片同时展示原文和翻译结果
- **可调节侧面板** - 右侧分屏面板（300px ~ 900px），拖拽左边缘可自由调整宽度
- **Azure 翻译引擎** - 使用 Microsoft Azure Translator API（`api.cognitive.microsofttranslator.com`），免费层每月 200 万字符额度
- **悬停高亮联动** - 鼠标悬停在翻译卡片上时，自动高亮页面中对应的原文段落并滚动定位到该位置
- **两级缓存系统** - 内存 Map + `chrome.storage.local` 双层缓存，最多 5000 条记录，超出配额自动淘汰
- **渐进式渲染** - 翻译结果按批次逐段渲染，无需等待全部完成即可开始阅读
- **批量翻译** - 单次 API 请求最多 50 段文本 / 50000 字符，1 秒限速间隔，指数退避重试
- **自动翻译** - 可选功能，页面加载后自动触发翻译（字符数在限额内时）
- **10 种语言互译** - 中文、英语、日语、韩语、法语、德语、西班牙语、俄语、葡萄牙语、意大利语
- **深色模式** - 支持跟随系统自动切换、手动浅色/深色三种主题
- **可拖拽浮动按钮** - FAB 悬浮按钮支持拖拽移动，自动吸附到屏幕边缘
- **API 密钥安全** - Background Service Worker 代理所有 API 调用，Content Script 无法接触密钥

---

## 安装方式

### Chrome / Edge

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目的 `auto-translate` 文件夹

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「临时载入附加组件」
3. 选择项目中的 `manifest.json` 文件

---

## Azure 翻译服务配置

本扩展使用 **Azure Translator** 作为翻译引擎，需要先获取 API Key 和区域标识。

### 获取 API Key 和 Region

1. 登录 [Azure 门户](https://portal.azure.com/)
2. 搜索并创建「Translator」（翻译器）资源
3. 定价层选择 **Free F0**（每月 200 万字符免费额度）
4. 创建完成后进入资源页面，在「密钥和终结点」中获取：
   - **Key**（密钥） - 复制 KEY 1 或 KEY 2
   - **Region**（区域） - 如 `eastasia`、`westus2`、`global` 等
5. 在扩展设置页面填入上述两项信息并保存

### Azure 免费层说明

| 项目 | 免费层限制 |
|------|-----------|
| 每月字符数 | 2,000,000 字符 |
| 并发请求数 | 有限 |
| 每秒事务数 | 有限 |
| 数据保留 | 不用于模型训练 |

### Azure 语言代码映射

本扩展在内部自动将标准语言代码映射为 Azure Translator 所需的格式：

| 语言 | 内部代码 | Azure 代码 |
|------|---------|-----------|
| 中文 | ZH | zh-Hans |
| 英语 | EN | en |
| 日语 | JA | ja |
| 韩语 | KO | ko |
| 法语 | FR | fr |
| 德语 | DE | de |
| 西班牙语 | ES | es |
| 俄语 | RU | ru |
| 葡萄牙语 | PT | pt-BR |
| 意大利语 | IT | it |

---

## 使用方式

1. **浮动按钮** - 页面右下角会出现蓝色翻译按钮（可拖拽），点击打开翻译侧面板
2. **快捷键** - `Alt+T` 切换面板显示，`Alt+Shift+T` 直接翻译当前页面
3. **翻译面板** - 选择源语言和目标语言后点击「翻译」，内容会逐段显示翻译结果
4. **调整宽度** - 拖拽面板左边缘可调整宽度（300px ~ 900px）
5. **悬停定位** - 鼠标悬停在翻译卡片上，页面自动高亮并滚动到对应原文段落
6. **复制文本** - 悬停在卡片上，点击右上角复制按钮可复制原文或译文
7. **自动翻译** - 在设置中开启后，符合条件的页面加载时自动翻译

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt + T` | 打开 / 关闭翻译侧面板 |
| `Alt + Shift + T` | 直接翻译当前页面 |

---

## 设置说明

安装后会自动打开设置页面（也可点击浏览器工具栏的插件图标进入设置）：

| 设置项 | 说明 |
|--------|------|
| Azure API Key | 翻译服务的 API 密钥 |
| Azure Region | 翻译服务所在的 Azure 区域 |
| 源语言 | 原文语言（支持自动检测） |
| 目标语言 | 翻译目标语言 |
| 自动翻译 | 页面加载后自动触发翻译（字符数在限额内时生效） |
| 字符上限 | 单次翻译的最大字符数限制 |
| 主题 | 跟随系统 / 浅色 / 深色 |

---

## 缓存机制

扩展采用两级缓存架构，有效减少重复翻译的 API 调用：

- **第一级：内存缓存** - 使用 JavaScript `Map` 实现，访问速度极快，页面刷新后清空
- **第二级：持久化缓存** - 使用 `chrome.storage.local` 存储，跨会话保留
- **缓存上限** - 最多 5000 条翻译记录，超出配额时自动淘汰最旧条目
- **缓存键** - 以 `源语言 + 目标语言 + 文本内容` 的哈希作为唯一键

已翻译的内容在再次访问相同页面或内容时直接从缓存读取，无需重复调用 API。

---

## 技术架构

```
Manifest V3 (Chrome Extension)
├── Background Service Worker  — Azure Translator API 代理 + 命令转发
│                                （密钥隔离：仅 Service Worker 持有 API Key）
├── Content Scripts
│   ├── extractor.js           — 智能 DOM 内容提取（多因子评分算法）
│   ├── translator.js          — 批量翻译管理（分批、限速、指数退避重试）
│   ├── cache.js               — 两级翻译缓存（内存 Map + chrome.storage.local）
│   ├── settings.js            — 设置管理（变更监听）
│   ├── panel.js               — 侧面板 UI（Shadow DOM 隔离）
│   └── content.js             — 主控脚本（FAB、消息通信、生命周期管理）
├── Popup                      — 工具栏弹出窗口
└── Options                    — 完整设置页面
```

### 关键设计决策

- **Shadow DOM 隔离** - 面板 UI 注入到 Shadow DOM 中，避免与目标页面的 CSS/JS 产生冲突
- **消息代理架构** - Content Script 不直接调用 Azure API，通过 Background Service Worker 代理，确保 API Key 安全
- **批量翻译** - 单次 API 请求最多包含 50 段文本（总计不超过 50000 字符），减少网络开销
- **渐进式渲染** - 翻译结果按批次逐段显示，用户无需等待全部翻译完成
- **限速与重试** - 批次间 1 秒间隔，遇到限流时指数退避重试
- **页面自适应** - 打开面板时自动调整页面 `margin-right`，不遮挡原文内容

### 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 存储 API Key、翻译缓存、用户设置 |
| `activeTab` | 访问当前活动标签页的内容 |
| `scripting` | 向页面注入 Content Script |

**Host Permissions**：仅请求 `https://api.cognitive.microsofttranslator.com/*`，用于调用 Azure Translator API。

---

## 项目结构

```
auto-translate/
├── manifest.json              # 插件配置 (Manifest V3)
├── background/
│   └── service-worker.js      # 后台服务（API 代理 + 命令转发）
├── content/
│   ├── extractor.js           # 智能内容提取器（多因子评分）
│   ├── translator.js          # Azure 翻译管理器（批量 + 限速 + 重试）
│   ├── cache.js               # 两级翻译缓存系统
│   ├── settings.js            # 设置管理（变更监听）
│   ├── panel.js               # 侧面板 UI（Shadow DOM）
│   ├── panel.css              # 面板外部样式（FAB 按钮）
│   └── content.js             # 主控脚本
├── popup/
│   ├── popup.html             # 工具栏弹窗
│   └── popup.js               # 弹窗逻辑
├── options/
│   ├── options.html           # 设置页面
│   └── options.js             # 设置逻辑
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## 许可证

MIT License
