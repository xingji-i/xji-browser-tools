# Auto Scroll Mobile — Safari 扩展转换指南

本项目是 `auto-page-turn` 的移动端适配版本，专为 Safari（iOS 15.4+ / macOS 12+）优化。

## 与 Chrome 版的差异

| 项目 | Chrome 版 | Mobile 版 (Safari) |
|------|-----------|-------------------|
| 命名空间 | chrome/browser 混用 | 统一 browser (chrome fallback) |
| 全局快捷键 | Ctrl+Space (manifest commands) | 无（iOS 不支持） |
| 键盘监听 | content script keydown | 无（移动端无物理键盘） |
| 指示器 | 小尺寸点击 | 大尺寸触控友好 (48px+ tap target) |
| Popup 宽度 | 260px | 280px，触控优化 |
| 权限 | activeTab + storage | 仅 storage |
| 后台逻辑 | commands 转发 + 安装默认值 | 仅安装默认值 |
| 速度计算 | 帧率无关 (dt-based) | 相同 |

## 前置要求

- Mac 电脑（必需，Windows 无法编译 iOS Safari 扩展）
- Xcode 14+（App Store 免费下载）
- Apple Developer 账号（真机测试/上架需要，年费 $99）

## 转换步骤

### 1. 执行 Safari 转换工具

```bash
# 切换 Xcode 命令行工具
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer

# 执行转换（生成 Mac + iOS 双平台 Xcode 项目）
xcrun safari-web-extension-converter ./auto-page-turn-mobile --include-ios
```

按提示填写：
- App 名称：Auto Scroll
- Bundle ID：com.yourname.autoscroll（反向域名格式）
- Developer Team：选择你的 Apple ID

### 2. 打开生成的 Xcode 项目

转换工具会生成一个 Xcode workspace，包含：
- `Shared (Extension)` — 扩展源码（就是本项目的文件）
- macOS App target
- iOS App target（配套 App 壳）

### 3. 手动修复（转换工具不会自动处理）

本项目的代码已经做了 Safari 兼容适配，通常无需额外修改。如果遇到问题：

**a) 如果报 `chrome is not defined`：**
代码已统一使用 `const ext = typeof browser !== "undefined" ? browser : chrome`，不应出现此问题。

**b) iOS 后台脚本不运行：**
本项目 background.js 仅在 `onInstalled` 时初始化默认值，不依赖持久后台，不受影响。

**c) Content script 未注入：**
检查 manifest.json 的 `matches` 字段。Safari 可能要求更精确的匹配规则。

### 4. 配置签名

在 Xcode 中：
1. 选择项目 → Targets → 分别选择 macOS App 和 iOS App Extension
2. Signing & Capabilities → 登录 Apple ID
3. 选择 "Sign to Run Locally"（本地调试）或你的开发者证书（上架）

### 5. 测试

**Mac：**
1. Xcode 选择 Mac Scheme → Run
2. Safari → 设置 → 扩展 → 启用 Auto Scroll
3. 开发菜单 → 允许未签名扩展（如果未签名）

**iPhone：**
1. 连接真机或选择 iOS 模拟器
2. Xcode 选择 iOS Scheme → Run
3. 在 iPhone 上：设置 → Safari → 扩展 → 启用 Auto Scroll
4. 打开任意网页测试

### 6. 上架 App Store

1. 在 App Store Connect 创建 App 记录
2. 配置 Bundle ID、隐私政策 URL
3. Xcode → Product → Archive → Distribute App
4. 提交审核（苹果会校验权限最小化、无违规网络拦截）

## 项目结构

```
auto-page-turn-mobile/
├── manifest.json          # MV3, Safari 兼容
├── background/
│   └── background.js      # 仅 onInstalled 初始化
├── content/
│   └── content.js         # 滚动引擎 + 触控指示器
├── popup/
│   ├── popup.html         # 触控优化 UI
│   ├── popup.css          # 移动端样式 (44px+ tap targets)
│   └── popup.js           # Popup 控制逻辑
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── CONVERSION.md          # 本文件
```

## 技术说明

### 滚动引擎
- 浮点 idealScrollY 追踪 + scrollTo（消除整数步进抖动）
- 帧率无关速度：speed(px/frame) × 60 = px/s × dt
- 用户手动滑动检测：偏移 >80px 自动重新同步

### iOS 特殊处理
- 指示器使用 touch-action: manipulation 避免 300ms 延迟
- -webkit-backdrop-filter 兼容 Safari
- -webkit-user-select 兼容 iOS
- 滑块 thumb 24px（Apple HIG 建议最小 44px tap area）
- Popup 使用 viewport meta 防止缩放

## 已知限制

- iOS Safari 扩展无法在设置页面以外的系统页面运行
- Service worker 在 iOS 上可能被系统杀死（本项目不依赖持久后台，无影响）
- Popup 在 iOS Safari 中以 sheet 形式弹出，而非 Chrome 的下拉菜单
- 无法在 iOS 上使用 manifest commands（已移除）
