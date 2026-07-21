/**
 * AutoTranslate - 翻译管理器
 * 封装 Azure Translator API 调用，处理批量翻译、速率限制、错误重试
 */

window.AutoTranslate = window.AutoTranslate || {};

window.AutoTranslate.Translator = (function() {
  'use strict';

  // 单次请求最大文本数
  const MAX_BATCH_SIZE = 50;
  // 单次请求最大字符数
  const MAX_BATCH_CHARS = 50000;
  // 请求间隔（毫秒）
  const REQUEST_INTERVAL = 1000;
  // 最大重试次数
  const MAX_RETRIES = 2;

  let lastRequestTime = 0;
  let charUsage = { used: 0, limit: 500000 }; // 免费版默认限额

  /**
   * 等待速率限制
   */
  function waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < REQUEST_INTERVAL) {
      return new Promise(resolve => setTimeout(resolve, REQUEST_INTERVAL - elapsed));
    }
    return Promise.resolve();
  }

  /**
   * 将文本数组分成适合 API 调用的批次
   */
  function splitBatches(texts) {
    const batches = [];
    let currentBatch = [];
    let currentChars = 0;

    for (const text of texts) {
      if (currentBatch.length >= MAX_BATCH_SIZE ||
          (currentChars + text.length > MAX_BATCH_CHARS && currentBatch.length > 0)) {
        batches.push(currentBatch);
        currentBatch = [];
        currentChars = 0;
      }
      currentBatch.push(text);
      currentChars += text.length;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * 发送翻译请求到 background service worker
   */
  async function requestTranslation(texts, sourceLang, targetLang) {
    await waitForRateLimit();

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'TRANSLATE',
        texts: texts,
        sourceLang: sourceLang,
        targetLang: targetLang
      }, (response) => {
        lastRequestTime = Date.now();

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response) {
          reject(new Error('未收到翻译服务响应'));
          return;
        }

        if (response.success) {
          // 更新字符用量
          const usedChars = texts.reduce((sum, t) => sum + t.length, 0);
          charUsage.used += usedChars;
          resolve(response.data);
        } else {
          reject(new Error(response.error || '翻译失败'));
        }
      });
    });
  }

  /**
   * 带重试的翻译
   */
  async function translateWithRetry(texts, sourceLang, targetLang, retries = MAX_RETRIES) {
    for (let i = 0; i <= retries; i++) {
      try {
        return await requestTranslation(texts, sourceLang, targetLang);
      } catch (error) {
        if (i === retries) throw error;
        // 429 错误等待更长时间
        if (error.message.includes('频繁')) {
          await new Promise(r => setTimeout(r, 5000 * (i + 1)));
        } else {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
      }
    }
  }

  /**
   * 批量翻译文本块
   * @param {Array<{id: string, text: string}>} blocks - 需要翻译的文本块
   * @param {string} sourceLang - 源语言 ('auto', 'ZH', 'EN', ...)
   * @param {string} targetLang - 目标语言 ('ZH', 'EN', ...)
   * @param {Function} onProgress - 进度回调 (translated, total) => void
   * @param {Function} onBlockTranslated - 单个块翻译完成回调 (block) => void
   * @returns {Array<{id: string, translation: string, sourceLang: string, targetLang: string}>}
   */
  async function translateBlocks(blocks, sourceLang, targetLang, onProgress, onBlockTranslated) {
    const texts = blocks.map(b => b.text);
    const batches = splitBatches(texts);
    const results = [];
    let translatedCount = 0;

    // 用于追踪每个文本在原始数组中的位置
    let globalIndex = 0;

    for (const batch of batches) {
      try {
        const data = await translateWithRetry(batch, sourceLang, targetLang);

        // 处理返回的翻译结果
        for (let i = 0; i < data.translations.length; i++) {
          const translation = data.translations[i];
          const originalBlock = blocks[globalIndex + i];

          const result = {
            id: originalBlock.id,
            originalText: originalBlock.text,
            translatedText: translation.text,
            detectedSourceLang: translation.detectedSourceLang || data.sourceLang,
            targetLang: data.targetLang
          };

          results.push(result);
          translatedCount++;

          // 单个块翻译完成回调
          if (onBlockTranslated) {
            onBlockTranslated(result);
          }
        }

        globalIndex += batch.length;

        // 进度回调
        if (onProgress) {
          onProgress(translatedCount, blocks.length);
        }
      } catch (error) {
        // 单批次失败，记录错误但继续翻译其他批次
        console.error('[AutoTranslate] 批次翻译失败:', error.message);
        for (let i = 0; i < batch.length; i++) {
          const originalBlock = blocks[globalIndex + i];
          results.push({
            id: originalBlock.id,
            originalText: originalBlock.text,
            translatedText: null,
            error: error.message
          });
        }
        globalIndex += batch.length;
        translatedCount += batch.length;

        if (onProgress) {
          onProgress(translatedCount, blocks.length);
        }
      }
    }

    return results;
  }

  /**
   * 翻译单段文本（快捷方法）
   */
  async function translateText(text, sourceLang, targetLang) {
    const data = await translateWithRetry([text], sourceLang, targetLang);
    return data.translations[0];
  }

  /**
   * 获取字符用量信息
   */
  function getUsage() {
    return { ...charUsage };
  }

  /**
   * 重置用量计数（每月重置）
   */
  function resetUsage() {
    charUsage.used = 0;
  }

  return {
    translateBlocks: translateBlocks,
    translateText: translateText,
    getUsage: getUsage,
    resetUsage: resetUsage,
    splitBatches: splitBatches
  };
})();
