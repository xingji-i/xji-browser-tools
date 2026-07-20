/**
 * AutoTranslate - 翻译缓存
 * 缓存已翻译的文本，避免重复 API 调用
 */

window.AutoTranslate = window.AutoTranslate || {};

window.AutoTranslate.Cache = (function() {
  'use strict';

  const CACHE_PREFIX = 'at_cache_';
  const META_KEY = 'at_cache_meta';
  const MAX_CACHE_ENTRIES = 5000;
  const CACHE_VERSION = 1;

  // 内存缓存（快速访问）
  let memoryCache = new Map();
  let cacheLoaded = false;

  /**
   * 生成文本的缓存 key（简单 hash）
   */
  function hashText(text, sourceLang, targetLang) {
    const input = `${sourceLang}:${targetLang}:${text}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return CACHE_PREFIX + Math.abs(hash).toString(36);
  }

  /**
   * 从 chrome.storage 加载缓存到内存
   */
  async function loadCache() {
    if (cacheLoaded) return;

    try {
      const all = await chrome.storage.local.get(null);
      for (const [key, value] of Object.entries(all)) {
        if (key.startsWith(CACHE_PREFIX)) {
          memoryCache.set(key, value);
        }
      }
      cacheLoaded = true;
    } catch (e) {
      console.warn('[AutoTranslate] 加载缓存失败:', e);
      cacheLoaded = true; // 防止重复尝试
    }
  }

  /**
   * 获取缓存的翻译
   */
  function get(text, sourceLang, targetLang) {
    const key = hashText(text, sourceLang, targetLang);
    const cached = memoryCache.get(key);
    if (cached && cached.version === CACHE_VERSION) {
      return cached.translatedText;
    }
    return null;
  }

  /**
   * 设置缓存
   */
  async function set(text, translatedText, sourceLang, targetLang) {
    const key = hashText(text, sourceLang, targetLang);
    const entry = {
      translatedText: translatedText,
      version: CACHE_VERSION,
      timestamp: Date.now(),
      textLength: text.length
    };

    memoryCache.set(key, entry);

    // 异步写入 storage（不阻塞）
    try {
      await chrome.storage.local.set({ [key]: entry });
    } catch (e) {
      // storage 满时清理旧缓存
      if (e.message && e.message.includes('QUOTA')) {
        await cleanOldEntries();
        // 重试一次
        try {
          await chrome.storage.local.set({ [key]: entry });
        } catch (e2) {
          console.warn('[AutoTranslate] 缓存写入失败:', e2);
        }
      }
    }
  }

  /**
   * 批量设置缓存
   */
  async function setBatch(items) {
    const data = {};
    for (const item of items) {
      const key = hashText(item.text, item.sourceLang, item.targetLang);
      const entry = {
        translatedText: item.translatedText,
        version: CACHE_VERSION,
        timestamp: Date.now(),
        textLength: item.text.length
      };
      memoryCache.set(key, entry);
      data[key] = entry;
    }

    try {
      await chrome.storage.local.set(data);
    } catch (e) {
      console.warn('[AutoTranslate] 批量缓存写入失败:', e);
    }
  }

  /**
   * 批量检查缓存命中
   */
  function getBatch(texts, sourceLang, targetLang) {
    const results = {
      hits: [],    // {index, text, translatedText}
      misses: []   // {index, text}
    };

    texts.forEach((text, index) => {
      const cached = get(text, sourceLang, targetLang);
      if (cached !== null) {
        results.hits.push({ index, text, translatedText: cached });
      } else {
        results.misses.push({ index, text });
      }
    });

    return results;
  }

  /**
   * 清理旧缓存条目（保留最近的 60%）
   */
  async function cleanOldEntries() {
    const entries = [];
    for (const [key, value] of memoryCache.entries()) {
      if (key.startsWith(CACHE_PREFIX)) {
        entries.push({ key, timestamp: value.timestamp || 0 });
      }
    }

    // 按时间戳排序
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // 删除最旧的 40%
    const deleteCount = Math.floor(entries.length * 0.4);
    const keysToDelete = entries.slice(0, deleteCount).map(e => e.key);

    for (const key of keysToDelete) {
      memoryCache.delete(key);
    }

    if (keysToDelete.length > 0) {
      try {
        await chrome.storage.local.remove(keysToDelete);
      } catch (e) {
        console.warn('[AutoTranslate] 清理缓存失败:', e);
      }
    }
  }

  /**
   * 清空所有缓存
   */
  async function clearAll() {
    const keysToDelete = [];
    for (const key of memoryCache.keys()) {
      if (key.startsWith(CACHE_PREFIX)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      memoryCache.delete(key);
    }

    if (keysToDelete.length > 0) {
      try {
        await chrome.storage.local.remove(keysToDelete);
      } catch (e) {
        console.warn('[AutoTranslate] 清空缓存失败:', e);
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  function getStats() {
    let totalChars = 0;
    let entryCount = 0;

    for (const [key, value] of memoryCache.entries()) {
      if (key.startsWith(CACHE_PREFIX)) {
        entryCount++;
        totalChars += (value.textLength || 0);
      }
    }

    return {
      entryCount: entryCount,
      totalChars: totalChars,
      maxEntries: MAX_CACHE_ENTRIES
    };
  }

  return {
    loadCache: loadCache,
    get: get,
    set: set,
    setBatch: setBatch,
    getBatch: getBatch,
    clearAll: clearAll,
    getStats: getStats
  };
})();
