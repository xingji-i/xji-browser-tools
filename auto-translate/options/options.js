/**
 * AutoTranslate - Options 页面脚本
 */

document.addEventListener('DOMContentLoaded', () => {
  // ========== 元素引用 ==========
  const apiKeyInput = document.getElementById('api-key');
  const accountTypeBtns = document.querySelectorAll('.account-type-btn');
  const sourceLangSelect = document.getElementById('source-lang');
  const targetLangSelect = document.getElementById('target-lang');
  const displayModeRadios = document.querySelectorAll('input[name="displayMode"]');
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  const panelWidthInput = document.getElementById('panel-width');
  const fontSizeInput = document.getElementById('font-size');
  const highlightHover = document.getElementById('highlight-hover');
  const autoTranslate = document.getElementById('auto-translate');
  const btnTestApi = document.getElementById('btn-test-api');
  const testResult = document.getElementById('test-result');
  const btnSave = document.getElementById('btn-save');
  const btnReset = document.getElementById('btn-reset');
  const btnClearCache = document.getElementById('btn-clear-cache');
  const btnExportCache = document.getElementById('btn-export-cache');
  const cacheCount = document.getElementById('cache-count');
  const cacheChars = document.getElementById('cache-chars');
  const toast = document.getElementById('toast');

  let isProAccount = false;

  // ========== 加载已保存的设置 ==========

  async function loadSettings() {
    const defaults = {
      deepLApiKey: '',
      deepLIsPro: false,
      sourceLang: 'auto',
      targetLang: 'ZH',
      autoTranslate: false,
      panelWidth: 420,
      displayMode: 'bilingual',
      fontSize: 15,
      highlightOnHover: true,
      theme: 'auto'
    };

    const settings = await chrome.storage.local.get(Object.keys(defaults));
    const s = { ...defaults, ...settings };

    apiKeyInput.value = s.deepLApiKey;
    isProAccount = s.deepLIsPro;
    updateAccountTypeUI();

    sourceLangSelect.value = s.sourceLang;
    targetLangSelect.value = s.targetLang;
    panelWidthInput.value = s.panelWidth;
    fontSizeInput.value = s.fontSize;
    highlightHover.checked = s.highlightOnHover;
    autoTranslate.checked = s.autoTranslate;

    // 设置 radio 选中状态
    displayModeRadios.forEach(radio => {
      radio.checked = radio.value === s.displayMode;
      radio.closest('.radio-option').classList.toggle('selected', radio.checked);
    });

    themeRadios.forEach(radio => {
      radio.checked = radio.value === s.theme;
      radio.closest('.radio-option').classList.toggle('selected', radio.checked);
    });

    // 加载缓存统计
    loadCacheStats();
  }

  // ========== 账户类型切换 ==========

  accountTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      isProAccount = btn.dataset.type === 'pro';
      updateAccountTypeUI();
    });
  });

  function updateAccountTypeUI() {
    accountTypeBtns.forEach(btn => {
      btn.classList.toggle('active',
        (btn.dataset.type === 'pro') === isProAccount
      );
    });
  }

  // ========== Radio group UI ==========

  function setupRadioGroup(radios) {
    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        radios.forEach(r => {
          r.closest('.radio-option').classList.toggle('selected', r.checked);
        });
      });
    });
  }

  setupRadioGroup(displayModeRadios);
  setupRadioGroup(themeRadios);

  // ========== API 测试 ==========

  btnTestApi.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showTestResult('请输入 API Key', 'error');
      return;
    }

    showTestResult('正在测试连接...', 'loading');
    btnTestApi.disabled = true;

    try {
      const endpoint = isProAccount
        ? 'https://api.deepl.com/v2/translate'
        : 'https://api-free.deepl.com/v2/translate';

      const body = new URLSearchParams();
      body.append('auth_key', apiKey);
      body.append('text', 'Hello, AutoTranslate!');
      body.append('target_lang', 'ZH');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      if (response.ok) {
        const data = await response.json();
        const translated = data.translations[0].text;
        showTestResult(`连接成功！测试翻译: "Hello, AutoTranslate!" → "${translated}"`, 'success');
      } else {
        const text = await response.text();
        let msg = `API 错误 (${response.status})`;
        if (response.status === 403) msg = 'API Key 无效，请检查后重试';
        else if (response.status === 456) msg = '字符额度已用完，请升级或等待下月重置';
        showTestResult(`${msg}: ${text}`, 'error');
      }
    } catch (error) {
      showTestResult(`网络错误: ${error.message}`, 'error');
    }

    btnTestApi.disabled = false;
  });

  function showTestResult(text, type) {
    testResult.style.display = 'block';
    testResult.textContent = text;
    testResult.className = 'test-result ' + (type || '');
  }

  // ========== 保存设置 ==========

  btnSave.addEventListener('click', async () => {
    const settings = {
      deepLApiKey: apiKeyInput.value.trim(),
      deepLIsPro: isProAccount,
      sourceLang: sourceLangSelect.value,
      targetLang: targetLangSelect.value,
      autoTranslate: autoTranslate.checked,
      panelWidth: parseInt(panelWidthInput.value) || 420,
      displayMode: document.querySelector('input[name="displayMode"]:checked').value,
      fontSize: parseInt(fontSizeInput.value) || 15,
      highlightOnHover: highlightHover.checked,
      theme: document.querySelector('input[name="theme"]:checked').value
    };

    try {
      await chrome.storage.local.set(settings);
      showToast('设置已保存', 'success');
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    }
  });

  // ========== 重置设置 ==========

  btnReset.addEventListener('click', async () => {
    if (!confirm('确定要恢复所有默认设置吗？')) return;

    const defaults = {
      deepLApiKey: '',
      deepLIsPro: false,
      sourceLang: 'auto',
      targetLang: 'ZH',
      autoTranslate: false,
      panelWidth: 420,
      displayMode: 'bilingual',
      fontSize: 15,
      highlightOnHover: true,
      theme: 'auto'
    };

    await chrome.storage.local.set(defaults);
    loadSettings();
    showToast('已恢复默认设置', 'success');
  });

  // ========== 缓存管理 ==========

  async function loadCacheStats() {
    const all = await chrome.storage.local.get(null);
    let count = 0;
    let chars = 0;

    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith('at_cache_')) {
        count++;
        chars += (value.textLength || 0);
      }
    }

    cacheCount.textContent = count.toLocaleString();
    cacheChars.textContent = chars > 10000
      ? Math.round(chars / 1000) + 'k'
      : chars.toLocaleString();
  }

  btnClearCache.addEventListener('click', async () => {
    if (!confirm('确定要清除所有翻译缓存吗？清除后翻译相同内容将重新调用 API。')) return;

    const all = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(all).filter(k => k.startsWith('at_cache_'));

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }

    loadCacheStats();
    showToast(`已清除 ${keysToRemove.length} 条缓存`, 'success');
  });

  btnExportCache.addEventListener('click', async () => {
    const all = await chrome.storage.local.get(null);
    const cache = {};

    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith('at_cache_')) {
        cache[key] = value;
      }
    }

    const blob = new Blob([JSON.stringify(cache, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autotranslate-cache-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('缓存已导出', 'success');
  });

  // ========== Toast ==========

  function showToast(message, type) {
    toast.textContent = message;
    toast.className = 'toast ' + (type || '') + ' show';
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // ========== 初始化 ==========
  loadSettings();
});
