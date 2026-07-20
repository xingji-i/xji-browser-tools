/**
 * background.js — 自动翻页扩展的后台服务
 * 职责：
 *   1. 处理 Ctrl+Space 快捷键，转发 toggle 给当前标签页
 *   2. 安装时初始化默认设置
 */

// 兼容 Chrome 和 Firefox 的 API 命名
const browser = typeof globalThis.browser !== "undefined" ? globalThis.browser : chrome;

// ─── 键盘命令处理 ────────────────────────────────────────────
browser.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-scroll") return;

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await browser.tabs.sendMessage(tab.id, { action: "toggle" });
  } catch (e) {
    // content script 未加载时忽略（比如 chrome:// 页面）
  }
});

// ─── 安装/更新时初始化默认设置 ───────────────────────────────
browser.runtime.onInstalled.addListener(() => {
  browser.storage.local.get("scrollSettings", (result) => {
    if (!result.scrollSettings) {
      browser.storage.local.set({
        scrollSettings: {
          speed: 0.4,       // 0.1~3.0 px/帧，默认 0.4
          direction: "down", // "up" | "down"
          smooth: true     // 是否启用平滑滚动
        }
      });
    }
  });
});
