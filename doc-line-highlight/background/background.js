/**
 * Doc Line Highlight - background.js (Service Worker)
 * 将 manifest commands 转发给当前 tab 的 content script
 */

chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(
      tabs[0].id,
      { type: "DLH_COMMAND", command },
      (response) => {
        if (chrome.runtime.lastError) {
          // content script 可能未加载（如 chrome:// 页面）
          console.warn("[DLH] 无法发送命令到页面:", chrome.runtime.lastError.message);
        }
      }
    );
  });
});
