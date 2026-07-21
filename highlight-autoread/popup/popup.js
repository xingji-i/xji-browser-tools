/**
 * Highlight AutoRead - Popup 控制面板逻辑
 */
(function () {
  'use strict';

  /* ===== 速度映射 ===== */
  const SPEED_MAP = [8, 6, 5, 4, 3, 2.5, 2, 1.5, 1.2, 0.8];

  /* ===== DOM 引用 ===== */
  const $ = (id) => document.getElementById(id);
  const statusDot = $('statusDot');
  const statusLabel = $('statusLabel');
  const statusLine = $('statusLine');
  const btnAutoRead = $('btnAutoRead');
  const btnAutoIcon = $('btnAutoIcon');
  const btnAutoText = $('btnAutoText');
  const speedSlider = $('speedSlider');
  const speedBadge = $('speedBadge');
  const btnPrev = $('btnPrev');
  const btnNext = $('btnNext');
  const lineDisplay = $('lineDisplay');
  const textPreview = $('textPreview');
  const gotoInput = $('gotoInput');
  const btnGoto = $('btnGoto');
  const btnHighlight = $('btnHighlight');
  const bgColor = $('bgColor');
  const outlineColor = $('outlineColor');
  const contentRootInfo = $('contentRootInfo');

  let currentTab = null;
  let lastState = null;

  /* ===== 通信辅助 ===== */
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    return tab;
  }

  async function sendToContent(msg) {
    const tab = currentTab || await getActiveTab();
    if (!tab) return null;
    try {
      return await chrome.tabs.sendMessage(tab.id, msg);
    } catch {
      return null;
    }
  }

  /* ===== 状态刷新 ===== */
  async function refreshState() {
    const state = await sendToContent({ type: 'HAR_GET_STATE' });
    if (!state) {
      statusLabel.textContent = '不可用';
      statusDot.className = 'status-dot';
      lineDisplay.textContent = '- / -';
      textPreview.textContent = '当前页面不支持';
      return;
    }

    lastState = state;

    // 状态指示
    if (state.autoReading) {
      statusDot.className = 'status-dot active';
      statusLabel.textContent = '跟读中';
    } else if (state.highlightActive) {
      statusDot.className = 'status-dot highlight';
      statusLabel.textContent = '高亮中';
    } else {
      statusDot.className = 'status-dot';
      statusLabel.textContent = '已停止';
    }

    // 行号
    if (state.highlightActive || state.autoReading) {
      lineDisplay.textContent = state.currentIndex + ' / ' + state.totalLines;
      statusLine.textContent = '';
    } else {
      lineDisplay.textContent = '- / ' + (state.totalLines || '-');
    }

    // 文本预览
    textPreview.textContent = state.currentText || '等待开始…';

    // 主体区域信息
    if (state.contentRoot) {
      contentRootInfo.textContent = '主体区域: <' + state.contentRoot + '>';
      contentRootInfo.style.display = '';
    } else {
      contentRootInfo.style.display = 'none';
    }

    // 按钮状态
    if (state.autoReading) {
      btnAutoRead.classList.add('running');
      btnAutoIcon.textContent = '⏸';
      btnAutoText.textContent = '暂停跟读';
    } else {
      btnAutoRead.classList.remove('running');
      btnAutoIcon.textContent = '▶';
      btnAutoText.textContent = '开始跟读';
    }

    // 高亮按钮
    if (state.highlightActive) {
      btnHighlight.classList.add('active');
    } else {
      btnHighlight.classList.remove('active');
    }

    // 速度同步
    speedSlider.value = state.speedLevel;
    speedBadge.textContent = state.dwellSeconds + 's';

    // 颜色同步
    bgColor.value = state.settings.highlightColor;
    outlineColor.value = state.settings.outlineColor;

    // 跳转输入范围
    gotoInput.max = state.totalLines;
  }

  /* ===== 事件绑定 ===== */

  // 自动跟读按钮
  btnAutoRead.addEventListener('click', async () => {
    await sendToContent({ type: 'HAR_TOGGLE_AUTO' });
    setTimeout(refreshState, 120);
  });

  // 高亮按钮（仅高亮，不自动滚动）
  btnHighlight.addEventListener('click', async () => {
    await sendToContent({ type: 'HAR_TOGGLE_HIGHLIGHT' });
    setTimeout(refreshState, 120);
  });

  // 上一行/下一行
  btnPrev.addEventListener('click', async () => {
    await sendToContent({ type: 'HAR_COMMAND', command: 'prev-line' });
    setTimeout(refreshState, 120);
  });

  btnNext.addEventListener('click', async () => {
    await sendToContent({ type: 'HAR_COMMAND', command: 'next-line' });
    setTimeout(refreshState, 120);
  });

  // 速度滑块
  speedSlider.addEventListener('input', async () => {
    const level = parseInt(speedSlider.value);
    const seconds = SPEED_MAP[level - 1];
    speedBadge.textContent = seconds + 's';
    await sendToContent({ type: 'HAR_SET_SPEED', speed: level });
    // 持久化
    const tab = await getActiveTab();
    chrome.storage.local.get('har_settings', (result) => {
      const s = result.har_settings || {};
      s.speed = level;
      chrome.storage.local.set({ har_settings: s });
    });
  });

  // 跳转到行
  btnGoto.addEventListener('click', async () => {
    const line = parseInt(gotoInput.value);
    if (line >= 1) {
      await sendToContent({ type: 'HAR_GOTO_LINE', line });
      setTimeout(refreshState, 120);
    }
  });

  gotoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnGoto.click();
    }
  });

  // 颜色选择器
  bgColor.addEventListener('input', async () => {
    await sendToContent({
      type: 'HAR_UPDATE_SETTINGS',
      settings: { highlightColor: bgColor.value }
    });
    saveColors();
  });

  outlineColor.addEventListener('input', async () => {
    await sendToContent({
      type: 'HAR_UPDATE_SETTINGS',
      settings: { outlineColor: outlineColor.value }
    });
    saveColors();
  });

  function saveColors() {
    chrome.storage.local.get('har_settings', (result) => {
      const s = result.har_settings || {};
      s.highlightColor = bgColor.value;
      s.outlineColor = outlineColor.value;
      chrome.storage.local.set({ har_settings: s });
    });
  }

  /* ===== 定时刷新 ===== */
  setInterval(refreshState, 1000);

  /* ===== 初始化 ===== */
  refreshState();
})();
