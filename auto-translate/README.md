# AutoTranslate - 双语对照翻译浏览器插件

DeepL 驱动的智能双语段落对照翻译浏览器扩展。自动识别页面内容，在可调节宽度的侧面板中展示原文与译文的逐段对照，适用于网页文章、新闻、博客、电子书等阅读场景。

## 核心功能

- **智能内容提取** - 自动识别页面中的文章正文，过滤导航栏、广告、侧边栏等噪音内容
- **段落级双语对照** - 原文和译文逐段排列，每张卡片同时展示原文和翻译结果
- **可调节侧面板** - 右侧分屏面板，拖拽左边缘可自由调整宽度（300px ~ 900px）
- **DeepL 翻译引擎** - 支持 DeepL Free / Pro 两种账户，翻译质量业界领先
- **翻译缓存** - 已翻译的内容自动缓存，再次访问相同内容无需重复调用 API
- **悬停高亮** - 鼠标悬停在翻译卡片上时，自动高亮页面中对应的原文段落并滚动定位
- **快捷键支持** - Alt+T 打开/关闭面板，Alt+Shift+T 一键翻译当前页面
- **多语言支持** - 中文、英语、日语、韩语、法语、德语等 10+ 种语言互译
- **深色模式** - 支持跟随系统、手动浅色/深色三种主题

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

## 配置

安装后会自动打开设置页面（也可点击浏览器工具栏的插件图标进入设置）：

1. **获取 DeepL API Key** - 前往 [DeepL API](https://www.deepl.com/pro-api) 注册并获取免费 API Key
2. **选择账户类型** - Free（免费，50 万字符/月）或 Pro（付费）
3. **输入 API Key** - 在设置页面填入 Key 并点击「测试连接」验证
4. **设置语言方向** - 源语言建议选「自动检测」，目标语言选你需要的语言

## 使用方式

1. **浮动按钮** - 页面右下角会出现一个蓝色翻译按钮，点击打开翻译面板
2. **快捷键** - `Alt+T` 切换面板显示，`Alt+Shift+T` 直接翻译当前页面
3. **翻译面板** - 选择语言方向后点击「翻译」，内容会逐段显示翻译结果
4. **调整宽度** - 拖拽面板左边缘可调整宽度
5. **复制文本** - 悬停在卡片上，点击右上角复制按钮可复制原文或译文

## 技术架构

```
Manifest V3 (Chrome Extension)
├── Background Service Worker  — DeepL API 代理 + 消息路由
├── Content Scripts
│   ├── extractor.js          — 智能 DOM 内容提取（评分算法定位主内容区）
│   ├── translator.js         — 批量翻译管理（分批、限速、重试）
│   ├── cache.js              — 翻译缓存（内存 + chrome.storage 双层）
│   ├── settings.js           — 设置管理
│   ├── panel.js              — 侧面板 UI（Shadow DOM 隔离）
│   └── content.js            — 主控脚本（FAB、消息通信、生命周期）
├── Popup                     — 工具栏弹出窗口
└── Options                   — 完整设置页面
```

### 关键设计决策

- **Shadow DOM 隔离** - 面板 UI 注入到 Shadow DOM 中，避免与目标页面的 CSS/JS 冲突
- **消息代理架构** - Content script 不直接调用 DeepL API，通过 background service worker 代理，便于统一管理和密钥保护
- **批量翻译** - 单次 API 请求最多 50 段文本，减少网络开销
- **渐进式显示** - 翻译结果逐段渲染，无需等待全部完成
- **页面自适应** - 打开面板时自动调整页面 `margin-right`，不遮挡原文

## 全平台规划

| 平台 | 技术栈 | 定位 | 状态 |
|------|--------|------|------|
| 浏览器插件 | Manifest V3 + Vanilla JS | 通用网页翻译 | **已完成** |
| 移动端 | Flutter | 随身阅读翻译（EPUB/PDF导入+浮窗翻译） | 规划中 |
| 桌面端 | Tauri 2.0 + Vue 3 | 深度阅读体验（本地电子书+分栏阅读） | 规划中 |

## 项目结构

```
auto-translate/
├── manifest.json              # 插件配置 (Manifest V3)
├── background/
│   └── service-worker.js      # 后台服务（API 代理 + 路由）
├── content/
│   ├── extractor.js           # 智能内容提取器
│   ├── translator.js          # DeepL 翻译管理器
│   ├── cache.js               # 翻译缓存系统
│   ├── settings.js            # 设置管理
│   ├── panel.js               # 侧面板 UI
│   ├── panel.css              # 面板外部样式（FAB按钮）
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

## 许可证

MIT License
