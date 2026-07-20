/**
 * background.js — 自动翻页扩展的后台服务
 * 职责：
 *   1. 处理键盘快捷键命令，转发给当前标签页的 content script
 *   2. 管理扩展状态（是否在滚动中）
 */

// 兼容 Chrome 和 Firefox 的 API 命名
const browser = typeof globalThis.browser !== "undefined" ? globalThis.browser : chrome;

// ─── 键盘命令处理 ────────────────────────────────────────────
browser.commands.onCommand.addListener(async (command) => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    if (command === "toggle-scroll") {
      await browser.tabs.sendMessage(tab.id, { action: "toggle" });
    } else if (command === "reverse-direction") {
      await browser.tabs.sendMessage(tab.id, { action: "reverse" });
    }
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
