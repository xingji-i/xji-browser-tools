/**
 * Highlight AutoRead - Background Service Worker
 * 合并：命令转发 + 设置初始化
 */
(function () {
  const api = globalThis.browser || chrome;

  // 默认设置
  const DEFAULTS = {
    speed: 3,           // 速度档位 1-10，对应每行停留秒数
    highlightColor: '#fff3b0',
    outlineColor: '#ffb300',
    skipEmpty: true,
    autoScroll: true
  };

  // 安装时初始化默认设置
  api.runtime.onInstalled.addListener(() => {
    api.storage.local.get('har_settings', (result) => {
      if (!result.har_settings) {
        api.storage.local.set({ har_settings: DEFAULTS });
      }
    });
  });

  // 转发 manifest commands 到 content script
  api.commands.onCommand.addListener((command) => {
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        api.tabs.sendMessage(tabs[0].id, {
          type: 'HAR_COMMAND',
          command: command
        }, () => {
          // 静默处理：chrome:// 等页面无法注入 content script
          if (api.runtime.lastError) { /* ignore */ }
        });
      }
    });
  });
})();
