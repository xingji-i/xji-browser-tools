/**
 * Highlight AutoRead - Content Script
 * 合并：逐行高亮引擎 + 自动跟读引擎
 */
(function () {
  'use strict';

  /* ===== 兼容层 ===== */
  const api = globalThis.browser || chrome;

  /* ===== 配置 ===== */
  // 速度档位 → 每行停留秒数映射（非线性）
  const SPEED_MAP = [8, 6, 5, 4, 3, 2.5, 2, 1.5, 1.2, 0.8];

  const LINE_SELECTORS = [
    // PDF.js
    '.textLayer span',
    '.pdfViewer .text-item',
    // GitHub 代码
    '.js-file-line',
    '.blob-code-inner',
    // Markdown 渲染
    '.markdown-body p',
    '.markdown-body li',
    '.markdown-body h1', '.markdown-body h2', '.markdown-body h3',
    '.markdown-body h4', '.markdown-body h5', '.markdown-body h6',
    '.markdown-body blockquote p',
    '.markdown-body .highlight pre code .code-line',
    // 通用文章容器
    'article p', 'article li', 'article h1', 'article h2', 'article h3',
    'main p', 'main li',
    '.post-content p', '.post-content li',
    '.article-content p', '.article-content li',
    // 代码块
    'pre code .code-line',
    // 兜底
    'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'td', 'dt', 'dd'
  ];

  /* ===== 状态 ===== */
  let lines = [];
  let currentIndex = -1;
  let highlightActive = false;
  let autoReading = false;
  let autoTimer = null;
  let dwellSeconds = SPEED_MAP[2]; // 默认档位 3 → 5s
  let speedLevel = 3;
  let settings = {
    highlightColor: '#fff3b0',
    outlineColor: '#ffb300',
    skipEmpty: true,
    autoScroll: true
  };

  // 同页面位置记忆
  let savedIndex = -1;
  let savedText = '';
  let savedUrl = '';

  // 滚动同步防抖
  let _ignoreScroll = false;

  /* ===== 行收集 ===== */
  function collectLines() {
    const selector = LINE_SELECTORS.join(',');
    const raw = document.querySelectorAll(selector);
    const seen = new Set();
    const arr = [];

    for (const el of raw) {
      if (seen.has(el)) continue;
      seen.add(el);
      // 过滤不可见
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      // 过滤空内容
      if (settings.skipEmpty) {
        const t = el.textContent.trim();
        if (!t) continue;
      }
      arr.push(el);
    }

    // DOM 顺序排序
    arr.sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    // 父子去重：如果父已在列表中，移除子
    const filtered = [];
    for (const el of arr) {
      let dominated = false;
      for (const other of arr) {
        if (other !== el && other.contains(el)) {
          dominated = true;
          break;
        }
      }
      if (!dominated) filtered.push(el);
    }

    return filtered;
  }

  /* ===== 高亮引擎 ===== */
  function applyHighlight(index) {
    // 清除旧高亮
    const prev = document.querySelector('.har-highlight');
    if (prev) {
      prev.classList.remove('har-highlight');
      prev.style.removeProperty('--har-bg');
      prev.style.removeProperty('--har-outline');
    }

    if (index < 0 || index >= lines.length) return;

    const el = lines[index];
    el.classList.add('har-highlight');
    el.style.setProperty('--har-bg', settings.highlightColor);
    el.style.setProperty('--har-outline', settings.outlineColor);

    if (settings.autoScroll) {
      _ignoreScroll = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { _ignoreScroll = false; }, 600);
    }
  }

  function clearHighlight() {
    const prev = document.querySelector('.har-highlight');
    if (prev) {
      prev.classList.remove('har-highlight');
      prev.style.removeProperty('--har-bg');
      prev.style.removeProperty('--har-outline');
    }
  }

  /* ===== 行导航 ===== */
  function goToLine(index, refresh) {
    if (lines.length === 0 || index < 0 || index >= lines.length) return;
    currentIndex = index;
    if (highlightActive) {
      applyHighlight(currentIndex);
    }
    // 每 15 次导航刷新一次行列表（应对 SPA 动态内容）
    if (refresh && currentIndex % 15 === 0) {
      refreshLines();
    }
  }

  function refreshLines() {
    const oldLen = lines.length;
    lines = collectLines();
    if (currentIndex >= lines.length) {
      currentIndex = Math.max(0, lines.length - 1);
    }
  }

  /* ===== 自动跟读引擎 ===== */
  function startAutoRead() {
    if (!highlightActive) {
      toggleHighlight(true);
    }
    autoReading = true;
    scheduleNext();
    updateIndicator();
  }

  function stopAutoRead() {
    autoReading = false;
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    updateIndicator();
  }

  function scheduleNext() {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (!autoReading) return;
      if (currentIndex < lines.length - 1) {
        goToLine(currentIndex + 1, true);
        scheduleNext();
      } else {
        // 到达末尾，自动停止
        stopAutoRead();
      }
    }, dwellSeconds * 1000);
  }

  /* ===== 高亮开关 ===== */
  function toggleHighlight(forceOn) {
    const shouldActivate = forceOn !== undefined ? forceOn : !highlightActive;

    if (shouldActivate) {
      highlightActive = true;
      lines = collectLines();
      if (lines.length === 0) return;

      // 位置恢复
      if (savedUrl === location.href && savedIndex >= 0) {
        // 先按文本匹配
        const savedSnippet = savedText.slice(0, 80);
        let found = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].textContent.trim().slice(0, 80) === savedSnippet) {
            found = i;
            break;
          }
        }
        // 再按索引回退
        if (found === -1 && savedIndex < lines.length) {
          found = savedIndex;
        }
        currentIndex = found >= 0 ? found : 0;
      } else {
        currentIndex = 0;
      }

      applyHighlight(currentIndex);
      savedUrl = location.href;
    } else {
      // 关闭时保存位置
      if (currentIndex >= 0 && currentIndex < lines.length) {
        savedIndex = currentIndex;
        savedText = lines[currentIndex].textContent.trim();
        savedUrl = location.href;
      }
      highlightActive = false;
      stopAutoRead();
      clearHighlight();
      currentIndex = -1;
    }

    updateIndicator();
  }

  /* ===== 切换自动跟读 ===== */
  function toggleAutoRead() {
    if (autoReading) {
      stopAutoRead();
    } else {
      startAutoRead();
    }
  }

  /* ===== 手动导航 ===== */
  function nextLine() {
    if (!highlightActive) {
      toggleHighlight(true);
      return;
    }
    if (currentIndex < lines.length - 1) {
      goToLine(currentIndex + 1, true);
    }
    // 若自动跟读中，重置计时器
    if (autoReading) scheduleNext();
  }

  function prevLine() {
    if (!highlightActive) {
      toggleHighlight(true);
      return;
    }
    if (currentIndex > 0) {
      goToLine(currentIndex - 1, false);
    }
    if (autoReading) scheduleNext();
  }

  /* ===== 手动滚动检测 ===== */
  let scrollSyncTimer = null;
  window.addEventListener('scroll', () => {
    if (_ignoreScroll || !autoReading) return;
    // 用户在自动跟读期间手动滚动 → 暂停
    clearTimeout(scrollSyncTimer);
    scrollSyncTimer = setTimeout(() => {
      if (autoReading) {
        stopAutoRead();
      }
    }, 200);
  }, { passive: true });

  /* ===== 页面指示器 ===== */
  let indicator = null;
  let indicatorTimer = null;

  function createIndicator() {
    indicator = document.createElement('div');
    indicator.id = 'har-indicator';
    indicator.innerHTML =
      '<span class="har-ind-arrow"></span>' +
      '<span class="har-ind-text"></span>' +
      '<span class="har-ind-info"></span>';
    indicator.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAutoRead();
    });
    document.documentElement.appendChild(indicator);
    updateIndicator();
  }

  function updateIndicator() {
    if (!indicator) return;
    const arrow = indicator.querySelector('.har-ind-arrow');
    const text = indicator.querySelector('.har-ind-text');
    const info = indicator.querySelector('.har-ind-info');

    if (autoReading) {
      indicator.classList.add('har-ind-active');
      indicator.classList.remove('har-ind-highlight-only');
      arrow.textContent = '▶';
      text.textContent = '跟读中';
      info.textContent =
        (currentIndex + 1) + '/' + lines.length +
        ' · ' + dwellSeconds + 's/行';
    } else if (highlightActive) {
      indicator.classList.remove('har-ind-active');
      indicator.classList.add('har-ind-highlight-only');
      arrow.textContent = '◆';
      text.textContent = '高亮';
      info.textContent = (currentIndex + 1) + '/' + lines.length;
    } else {
      indicator.classList.remove('har-ind-active');
      indicator.classList.remove('har-ind-highlight-only');
      arrow.textContent = '◇';
      text.textContent = '已暂停';
      info.textContent = '';
    }
  }

  /* ===== 消息监听 ===== */
  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'HAR_COMMAND':
        switch (msg.command) {
          case 'toggle-autoread': toggleAutoRead(); break;
          case 'next-line': nextLine(); break;
          case 'prev-line': prevLine(); break;
          case 'toggle-highlight': toggleHighlight(); break;
        }
        sendResponse({ ok: true });
        break;

      case 'HAR_GET_STATE':
        sendResponse({
          highlightActive,
          autoReading,
          currentIndex: currentIndex + 1,
          totalLines: lines.length,
          currentText: currentIndex >= 0 && currentIndex < lines.length
            ? lines[currentIndex].textContent.trim().slice(0, 100)
            : '',
          speedLevel,
          dwellSeconds,
          settings
        });
        break;

      case 'HAR_TOGGLE_AUTO':
        toggleAutoRead();
        sendResponse({ autoReading });
        break;

      case 'HAR_TOGGLE_HIGHLIGHT':
        toggleHighlight();
        sendResponse({ highlightActive });
        break;

      case 'HAR_SET_SPEED':
        speedLevel = Math.max(1, Math.min(10, msg.speed));
        dwellSeconds = SPEED_MAP[speedLevel - 1];
        if (autoReading) scheduleNext();
        updateIndicator();
        sendResponse({ ok: true });
        break;

      case 'HAR_GOTO_LINE':
        if (!highlightActive) toggleHighlight(true);
        const lineIdx = Math.max(0, Math.min(msg.line - 1, lines.length - 1));
        goToLine(lineIdx, false);
        if (autoReading) scheduleNext();
        sendResponse({ ok: true });
        break;

      case 'HAR_UPDATE_SETTINGS':
        Object.assign(settings, msg.settings);
        if (highlightActive && currentIndex >= 0) {
          applyHighlight(currentIndex);
        }
        sendResponse({ ok: true });
        break;
    }
    return true;
  });

  /* ===== 页面级键盘快捷键（降级方案） ===== */
  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        e.target.isContentEditable) return;

    let handled = false;

    if (e.ctrlKey && !e.shiftKey && e.code === 'Space') {
      toggleAutoRead();
      handled = true;
    } else if (e.ctrlKey && !e.shiftKey && (e.code === 'ArrowDown' || e.key === 'ArrowDown')) {
      nextLine();
      handled = true;
    } else if (e.ctrlKey && !e.shiftKey && (e.code === 'ArrowUp' || e.key === 'ArrowUp')) {
      prevLine();
      handled = true;
    } else if (e.ctrlKey && e.shiftKey && (e.code === 'KeyL' || e.key === 'L')) {
      toggleHighlight();
      handled = true;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  /* ===== SPA 动态内容监听 ===== */
  let mutationTimer = null;
  const observer = new MutationObserver(() => {
    if (!highlightActive) return;
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      refreshLines();
      updateIndicator();
    }, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  /* ===== 初始化 ===== */
  function init() {
    api.storage.local.get('har_settings', (result) => {
      if (result.har_settings) {
        const s = result.har_settings;
        Object.assign(settings, {
          highlightColor: s.highlightColor || settings.highlightColor,
          outlineColor: s.outlineColor || settings.outlineColor,
          skipEmpty: s.skipEmpty !== undefined ? s.skipEmpty : settings.skipEmpty,
          autoScroll: s.autoScroll !== undefined ? s.autoScroll : settings.autoScroll
        });
        if (s.speed) {
          speedLevel = Math.max(1, Math.min(10, s.speed));
          dwellSeconds = SPEED_MAP[speedLevel - 1];
        }
      }
    });

    // 延迟创建指示器，确保 DOM 就绪
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createIndicator);
    } else {
      createIndicator();
    }
  }

  init();
})();
