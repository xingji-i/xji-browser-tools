# Auto Scroll Android — 安装与使用说明

本项目是 `auto-page-turn` 的 Android 移动端适配版本，采用深色主题（Material Design 风格），针对 Android 浏览器触控交互优化。

## 支持的浏览器

| 浏览器 | 扩展支持 | 加载方式 | 推荐度 |
|--------|---------|---------|--------|
| **Kiwi Browser** | 完整 MV3 | 开发者模式加载未打包扩展 | ★★★★★ |
| **Yandex Browser** | 完整 MV3 | Chrome Web Store 安装 | ★★★★ |
| **Firefox for Android** | 部分 MV3 | 需要 AMO 审核上架 | ★★★ |
| Samsung Internet | 不支持 | — | ✗ |
| Chrome for Android | 不支持 | — | ✗ |

**推荐使用 Kiwi Browser**：基于 Chromium，完整支持 Chrome 扩展，可直接加载本地未打包扩展。

## Kiwi Browser 安装步骤

### 1. 安装 Kiwi Browser

Google Play 搜索 "Kiwi Browser" 下载安装。

### 2. 开启开发者模式

1. 打开 Kiwi Browser
2. 地址栏输入 `kiwi://extensions`
3. 打开右上角 "Developer mode"（开发者模式）

### 3. 加载扩展

1. 将本项目文件夹传输到手机（USB / 云盘 / 蓝牙均可）
2. 在 `kiwi://extensions` 页面点击 "Load unpacked"（加载已解压的扩展）
3. 选择 `auto-page-turn-android` 文件夹
4. 扩展安装完成，地址栏右侧出现 ↕ 图标

### 4. 使用

1. 打开任意网页
2. 点击地址栏的扩展图标 → 弹出控制面板
3. 设置方向和速度 → 点击 "Start Scrolling"
4. 页面右下角出现浮动指示器，**点击指示器** 即可暂停/恢复滚动

## Firefox for Android 安装步骤

Firefox 的扩展生态较封闭，仅支持已上架 AMO (addons.mozilla.org) 的扩展。

如需使用，需要：
1. 注册 Mozilla 开发者账号
2. 将扩展打包为 .xpi 文件
3. 提交 AMO 审核（通常 1-3 天）
4. 审核通过后所有 Firefox for Android 用户可安装

## Yandex Browser 安装步骤

Yandex 支持从 Chrome Web Store 安装扩展：
1. 将扩展发布到 Chrome Web Store（需一次性 $5 注册费）
2. 在 Yandex Browser 中打开 Chrome Web Store 页面
3. 点击 "Add to Chrome" 安装

## 项目结构

```
auto-page-turn-android/
├── manifest.json              # MV3, Chrome 兼容 (Kiwi/Yandex)
├── README.md                  # 本文件
├── background/
│   └── background.js          # 安装时初始化默认设置
├── content/
│   └── content.js             # 滚动引擎 + 触控指示器 (深色)
├── popup/
│   ├── popup.html             # 深色主题触控 UI
│   ├── popup.css              # Material Design 风格样式
│   └── popup.js               # Popup 控制逻辑
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 与桌面 Chrome 版的差异

| 项目 | 桌面 Chrome 版 | Android 版 |
|------|---------------|-----------|
| 主题 | 浅色 | 深色 (Material) |
| 全局快捷键 | Ctrl+Space | 无 |
| 指示器 | 浅色小胶囊 | 深色大圆角，80px 底部偏移（避开导航栏） |
| Popup 宽度 | 260px | 300px |
| 按钮最小尺寸 | — | 46px (触控友好) |
| 滚动引擎 | 浮点 idealScrollY + 帧率无关 | 相同 |
| 手动滚动检测阈值 | 50px | 100px（Android 手势更敏感） |
| 命名空间 | chrome/browser 混用 | 统一 browser (chrome fallback) |

## 技术说明

### Android 动态视口
Android 浏览器的 URL 栏会随滚动显示/隐藏，导致 `window.innerHeight` 频繁变化。滚动引擎的边界钳位每帧重新计算 `maxScroll`，天然兼容此行为。

### 指示器定位
`bottom: 80px` 而非 `20px`，避免被 Android 底部导航栏（手势条/三键导航）遮挡。

### 触控反馈
- `touch-action: manipulation` 消除 300ms 点击延迟
- `touchstart/touchend` 提供按压缩放动画
- `-webkit-tap-highlight-color: transparent` 消除默认高亮

### 手动滚动检测
阈值设为 100px（桌面版 50px），因为 Android 触控滚动的惯性更大，较小的阈值会被正常惯性滚动误触发。

## 已知限制

- Chrome for Android 官方不支持扩展（Google 策略限制）
- Kiwi Browser 的 service worker 在后台可能被系统杀死（本项目不依赖持久后台，无影响）
- 部分网站（如银行 App 内嵌浏览器）可能阻止 content script 注入
