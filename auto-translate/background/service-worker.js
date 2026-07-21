/**
 * AutoTranslate - Background Service Worker
 * 处理 Azure Translator API 翻译请求，管理消息路由
 */

const AZURE_ENDPOINT = 'https://api.cognitive.microsofttranslator.com/translate';
const AZURE_API_VERSION = '3.0';

// Azure Translator 语言代码映射
const LANG_MAP = {
  'ZH': 'zh-Hans',
  'EN': 'en',
  'JA': 'ja',
  'KO': 'ko',
  'FR': 'fr',
  'DE': 'de',
  'ES': 'es',
  'RU': 'ru',
  'PT': 'pt-BR',
  'IT': 'it'
};

function toAzureLang(code) {
  if (!code || code === 'auto') return '';
  return LANG_MAP[code] || code.toLowerCase();
}

// 翻译请求队列，防止并发过多
let pendingRequests = [];
let isProcessing = false;

/**
 * 调用 Azure Translator API 翻译文本
 */
async function translateWithAzure(texts, sourceLang, targetLang, apiKey, region) {
  const params = new URLSearchParams({
    'api-version': AZURE_API_VERSION,
    'to': toAzureLang(targetLang)
  });

  const fromCode = toAzureLang(sourceLang);
  if (fromCode) {
    params.set('from', fromCode);
  }

  const body = texts.map(text => ({ Text: text }));

  const response = await fetch(`${AZURE_ENDPOINT}?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey,
      'Ocp-Apim-Subscription-Region': region || 'global'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Azure Translator 错误 (${response.status})`;
    if (response.status === 401) errorMessage = 'Azure API Key 无效或已过期';
    else if (response.status === 429) errorMessage = 'Azure API 请求过于频繁，请稍后再试';
    else if (response.status === 403) errorMessage = 'Azure API 权限不足，请检查 Key 和 Region';
    throw new Error(`${errorMessage}: ${errorText}`);
  }

  const data = await response.json();
  // Azure 返回数组，每项包含 translations[0].text 和 detectedLanguage
  return data.map(item => ({
    text: item.translations[0].text,
    detectedSourceLang: item.detectedLanguage
      ? (item.detectedLanguage.language || '').toUpperCase()
      : ''
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

  // 从 storage 获取 API Key 和 Region
  const settings = await chrome.storage.local.get(['azureApiKey', 'azureRegion', 'autoDetectDirection']);

  if (!settings.azureApiKey) {
    throw new Error('请先在设置中配置 Azure Translator API Key');
  }

  const apiKey = settings.azureApiKey;
  const region = settings.azureRegion || 'global';

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

  const results = await translateWithAzure(
    texts,
    effectiveSourceLang,
    effectiveTargetLang,
    apiKey,
    region
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
    chrome.storage.local.get(['azureApiKey'], (settings) => {
      sendResponse({
        configured: !!settings.azureApiKey
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
