/**
 * AutoTranslate - 设置管理器
 * 管理用户设置（API Key、语言方向、显示选项等）
 */

window.AutoTranslate = window.AutoTranslate || {};

window.AutoTranslate.Settings = (function() {
  'use strict';

  const DEFAULT_SETTINGS = {
    deepLApiKey: '',
    deepLIsPro: false,
    sourceLang: 'auto',       // 'auto', 'ZH', 'EN', 'JA', ...
    targetLang: 'ZH',         // 默认目标语言
    autoTranslate: false,     // 打开页面自动翻译
    panelWidth: 420,          // 面板默认宽度
    panelPosition: 'right',   // 'right' or 'left'
    displayMode: 'bilingual', // 'bilingual', 'translation-only', 'original-only'
    fontSize: 15,             // 翻译文字大小
    originalFontSize: 14,     // 原文字体大小
    showOriginal: true,       // 双语模式下显示原文
    highlightOnHover: true,   // 悬停高亮对应段落
    theme: 'auto',            // 'auto', 'light', 'dark'
    maxAutoTranslateChars: 10000, // 自动翻译的最大字符数
    translationDelay: 200     // 翻译段之间的延迟(ms)
  };

  let currentSettings = { ...DEFAULT_SETTINGS };
  let settingsLoaded = false;
  const listeners = [];

  /**
   * 加载设置
   */
  async function load() {
    try {
      const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
      currentSettings = { ...DEFAULT_SETTINGS, ...stored };
      settingsLoaded = true;
    } catch (e) {
      console.warn('[AutoTranslate] 加载设置失败:', e);
      currentSettings = { ...DEFAULT_SETTINGS };
      settingsLoaded = true;
    }
    return currentSettings;
  }

  /**
   * 保存设置
   */
  async function save(newSettings) {
    const changed = {};
    for (const [key, value] of Object.entries(newSettings)) {
      if (key in DEFAULT_SETTINGS) {
        currentSettings[key] = value;
        changed[key] = value;
      }
    }

    try {
      await chrome.storage.local.set(changed);
    } catch (e) {
      console.error('[AutoTranslate] 保存设置失败:', e);
    }

    // 通知监听器
    for (const listener of listeners) {
      try {
        listener(changed, currentSettings);
      } catch (e) {
        console.warn('[AutoTranslate] 设置变更监听器出错:', e);
      }
    }

    return currentSettings;
  }

  /**
   * 获取单个设置值
   */
  function get(key) {
    if (!settingsLoaded) {
      console.warn('[AutoTranslate] 设置尚未加载，返回默认值');
      return DEFAULT_SETTINGS[key];
    }
    return currentSettings[key];
  }

  /**
   * 获取所有设置
   */
  function getAll() {
    return { ...currentSettings };
  }

  /**
   * 监听设置变更
   */
  function onChange(listener) {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  }

  /**
   * 重置为默认设置
   */
  async function reset() {
    currentSettings = { ...DEFAULT_SETTINGS };
    await chrome.storage.local.set(DEFAULT_SETTINGS);
    return currentSettings;
  }

  /**
   * 检查 API Key 是否已配置
   */
  function isConfigured() {
    return !!currentSettings.deepLApiKey;
  }

  /**
   * 获取当前语言方向
   */
  function getLanguageDirection() {
    return {
      source: currentSettings.sourceLang,
      target: currentSettings.targetLang
    };
  }

  // 监听来自 options 页面的设置更新
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      const updated = {};
      for (const [key, { newValue }] of Object.entries(changes)) {
        if (key in DEFAULT_SETTINGS) {
          currentSettings[key] = newValue;
          updated[key] = newValue;
        }
      }
      if (Object.keys(updated).length > 0) {
        for (const listener of listeners) {
          listener(updated, currentSettings);
        }
      }
    });
  }

  return {
    load: load,
    save: save,
    get: get,
    getAll: getAll,
    onChange: onChange,
    reset: reset,
    isConfigured: isConfigured,
    getLanguageDirection: getLanguageDirection
  };
})();
