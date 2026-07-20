/**
 * AutoTranslate - Popup 脚本
 */

document.addEventListener('DOMContentLoaded', () => {
  const btnTranslate = document.getElementById('btn-translate');
  const btnScan = document.getElementById('btn-scan');
  const btnSettings = document.getElementById('btn-settings');
  const linkOptions = document.getElementById('link-options');
  const apiStatusCard = document.getElementById('api-status');
  const apiStatusText = document.getElementById('api-status-text');

  // 检查 API 配置状态
  checkApiStatus();

  // 翻译当前页面
  btnTranslate.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'START_TRANSLATE' }, (response) => {
          if (chrome.runtime.lastError) {
            showStatus('无法连接页面，请刷新后重试', 'error');
          } else {
            window.close(); // 关闭 popup
          }
        });
      }
    });
  });

  // 扫描页面
  btnScan.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SCAN_PAGE' }, (response) => {
          if (chrome.runtime.lastError) {
            showStatus('无法连接页面，请刷新后重试', 'error');
          } else if (response) {
            showStatus(`发现 ${response.blockCount} 段内容 (${response.detectedLang})`, 'success');
          }
        });
      }
    });
  });

  // 打开设置
  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  linkOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  function checkApiStatus() {
    chrome.storage.local.get(['deepLApiKey', 'deepLIsPro'], (settings) => {
      if (settings.deepLApiKey) {
        const type = settings.deepLIsPro ? 'Pro' : 'Free';
        apiStatusText.textContent = `DeepL API 已配置 (${type})`;
        apiStatusCard.classList.add('success');
        apiStatusCard.classList.remove('error');
      } else {
        apiStatusText.textContent = '未配置 API Key - 请点击设置';
        apiStatusCard.classList.add('error');
        apiStatusCard.classList.remove('success');
      }
    });
  }

  function showStatus(text, type) {
    apiStatusText.textContent = text;
    apiStatusCard.className = 'status-card ' + (type || '');
  }
});
