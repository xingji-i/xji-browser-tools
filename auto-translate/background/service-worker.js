/**
 * AutoTranslate - Background Service Worker
 * 处理 DeepL API 翻译请求，管理消息路由
 */

const DEEPL_FREE_ENDPOINT = 'https://api-free.deepl.com/v2/translate';
const DEEPL_PRO_ENDPOINT = 'https://api.deepl.com/v2/translate';

// 翻译请求队列，防止并发过多
let pendingRequests = [];
let isProcessing = false;

/**
 * 调用 DeepL API 翻译文本
 */
async function translateWithDeepL(texts, sourceLang, targetLang, apiKey, isProAccount) {
  const endpoint = isProAccount ? DEEPL_PRO_ENDPOINT : DEEPL_FREE_ENDPOINT;

  const body = new URLSearchParams();
  body.append('auth_key', apiKey);
  body.append('target_lang', targetLang);
  if (sourceLang && sourceLang !== 'auto') {
    body.append('source_lang', sourceLang);
  }

  // DeepL 支持批量翻译，一次请求多个 text 参数
  texts.forEach(text => body.append('text', text));

  // 保留段落格式
  body.append('tag_handling', 'html');
  body.append('ignore_tags', 'code,pre');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `DeepL API 错误 (${response.status})`;
    if (response.status === 403) errorMessage = 'DeepL API Key 无效或已过期';
    else if (response.status === 429) errorMessage = 'DeepL API 请求过于频繁，请稍后再试';
    else if (response.status === 456) errorMessage = 'DeepL API 字符额度已用完';
    throw new Error(`${errorMessage}: ${errorText}`);
  }

  const data = await response.json();
  return data.translations.map(t => ({
    text: t.text,
    detectedSourceLang: t.detected_source_lang
  }));
}

/**
 * 检测文本语言（简单的字符比例判断）
 */
function detectLanguage(text) {
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const totalAlpha = (text.match(/[a-zA-Z\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  if (totalAlpha === 0) return 'unknown';
  const ratio = chineseChars / totalAlpha;
  if (ratio > 0.3) return 'ZH';
  if (ratio < 0.05 && /[a-zA-Z]/.test(text)) return 'EN';
  return 'unknown';
}

/**
 * 处理翻译消息
 */
async function handleTranslateRequest(message, sender) {
  const { texts, sourceLang, targetLang } = message;

  // 从 storage 获取 API Key 和账户类型
  const settings = await chrome.storage.local.get(['deepLApiKey', 'deepLIsPro', 'autoDetectDirection']);

  if (!settings.deepLApiKey) {
    throw new Error('请先在设置中配置 DeepL API Key');
  }

  const apiKey = settings.deepLApiKey;
  const isPro = settings.deepLIsPro || false;

  // 如果源语言是 auto，尝试检测
  let effectiveSourceLang = sourceLang;
  let effectiveTargetLang = targetLang;

  if (sourceLang === 'auto' && texts.length > 0) {
    const detected = detectLanguage(texts[0]);
    if (detected === 'ZH') {
      effectiveSourceLang = 'ZH';
      effectiveTargetLang = targetLang || 'EN';
    } else if (detected === 'EN') {
      effectiveSourceLang = 'EN';
      effectiveTargetLang = targetLang || 'ZH';
    } else {
      effectiveSourceLang = '';
      effectiveTargetLang = targetLang || 'ZH';
    }
  }

  const results = await translateWithDeepL(
    texts,
    effectiveSourceLang,
    effectiveTargetLang,
    apiKey,
    isPro
  );

  return {
    translations: results,
    sourceLang: effectiveSourceLang,
    targetLang: effectiveTargetLang
  };
}

/**
 * 消息监听器
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSLATE') {
    handleTranslateRequest(message, sender)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开放（异步响应）
  }

  if (message.type === 'TOGGLE_PANEL') {
    // 向当前标签页发送切换面板消息
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_PANEL' });
      }
    });
    return;
  }

  if (message.type === 'TRANSLATE_PAGE') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'START_TRANSLATE' });
      }
    });
    return;
  }

  if (message.type === 'GET_STATUS') {
    // 返回插件状态
    chrome.storage.local.get(['deepLApiKey'], (settings) => {
      sendResponse({
        configured: !!settings.deepLApiKey
      });
    });
    return true;
  }
});

/**
 * 快捷键监听器
 */
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    if (command === 'toggle-panel') {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_PANEL' });
    } else if (command === 'translate-page') {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'START_TRANSLATE' });
    }
  });
});

/**
 * 安装/更新事件
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 首次安装，打开设置页面
    chrome.runtime.openOptionsPage();
  }
});
