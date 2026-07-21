/**
 * Highlight AutoRead - Content Script v2
 *
 * 修复要点:
 * 1. 智能主体内容检测 — 通过评分算法区分正文与导航/侧栏/页脚
 * 2. 滚动引擎重写 — rAF 位置对比替代 scroll 事件监听，杜绝误中断
 * 3. 滚动兼容 — scrollIntoView 失败时回退到手动计算滚动位置
 */
(function () {
  'use strict';

  /* ===== 兼容层 ===== */
  const api = globalThis.browser || chrome;

  /* ===== 配置 ===== */
  // 速度档位 → 每行停留秒数映射（非线性，1=最慢 10=最快）
  const SPEED_MAP = [8, 6, 5, 4, 3, 2.5, 2, 1.5, 1.2, 0.8];

  // 行级文本元素选择器（用于在已确定的主体区域内收集行）
  const LINE_SELECTORS = [
    // PDF.js
    '.textLayer span',
    '.pdfViewer .text-item',
    // GitHub 代码视图
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
    '.entry-content p', '.entry-content li',
    // 代码块
    'pre code .code-line',
    // 兜底（仅在无主体区域时使用）
    'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'td', 'dt', 'dd'
  ];

  // 内容型标签 — 统计它们在容器内的数量来评分
  const CONTENT_CHILD_SELECTOR =
    'p, h1, h2, h3, h4, h5, h6, li, blockquote, dt, dd, td, pre';

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

  // 程序滚动标记（替代旧的时间戳防抖）
  let _programScroll = false;
  let _lastScrollY = 0;

  // 主体内容缓存
  let _cachedRoot = null;
  let _cachedRootUrl = '';

  /* =============================================================
   * 智能主体内容检测
   * 原理：为页面上的容器元素打分，得分最高者视为正文区域。
   * 评分维度：内容子元素数量、纯文本长度、语义标签加分。
   * ============================================================= */

  function detectContentRoot() {
    // URL 变化时清除缓存
    if (_cachedRoot && _cachedRootUrl === location.href &&
        document.body.contains(_cachedRoot)) {
      return _cachedRoot;
    }

    // 1. 语义标签快速匹配
    const semanticSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.markdown-body',
      '.post-body',
      '.article-body',
      '.content-body',
      '.blog-post',
      '.reader-content'
    ];

    for (const sel of semanticSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 100) {
        _cachedRoot = el;
        _cachedRootUrl = location.href;
        return el;
      }
    }

    // 2. 候选容器收集：从每个文本元素向上查找父容器
    const textEls = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
    const scoreMap = new Map();

    const MAX_WALK = Math.min(textEls.length, 80);
    for (let i = 0; i < MAX_WALK; i++) {
      let el = textEls[i].parentElement;
      let depth = 0;
      while (el && el !== document.body && depth < 6) {
        if (el.tagName === 'HTML') break;
        if (!scoreMap.has(el)) scoreMap.set(el, 0);
        scoreMap.set(el, scoreMap.get(el) + 1);
        el = el.parentElement;
        depth++;
      }
    }

    // 3. 过滤非内容区域（nav/aside/footer/ad）
    const ncSelector = 'nav, aside, footer, [role="navigation"], [role="complementary"], [role="banner"], [role="contentinfo"]';
    const nonContentSet = new Set(document.querySelectorAll(ncSelector));

    for (const candidate of [...scoreMap.keys()]) {
      if (nonContentSet.has(candidate)) {
        scoreMap.delete(candidate);
        continue;
      }
      // class/id 包含广告/侧栏关键词
      const cls = ' ' + (candidate.className || '') + ' ';
      const id = candidate.id || '';
      if (cls.includes(' sidebar ') || cls.includes(' nav ') ||
          cls.includes(' menu ') || cls.includes(' ad-') || cls.includes(' footer ') ||
          cls.includes(' comment') || cls.includes(' cookie') ||
          id.includes('sidebar') || id.includes('nav') || id.includes('ad') ||
          id.includes('footer') || id.includes('comment')) {
        scoreMap.delete(candidate);
      }
    }

    // 4. 精细评分：内容密度 × 文本长度 + 语义标签加分
    const candidates = [...scoreMap.entries()].filter(([, v]) => v >= 3);
    // 限制评分数量
    const toScore = candidates.slice(0, 60);

    const scored = toScore.map(([el]) => {
      let score = 0;

      // 内容子元素数量
      const contentChildren = el.querySelectorAll(CONTENT_CHILD_SELECTOR);
      score += contentChildren.length * 3;

      // 纯文本长度（对数刻度，避免超长内容垄断）
      const textLen = el.textContent.trim().length;
      score += Math.min(Math.log10(Math.max(textLen, 1)) * 6, 25);

      // 语义标签加分
      const tag = el.tagName.toLowerCase();
      if (tag === 'article') score += 30;
      else if (tag === 'main') score += 25;
      else if (tag === 'section') score += 5;

      if (el.getAttribute('role') === 'main') score += 30;

      return { el, score };
    });

    scored.sort((a, b) => b.score - a.score);

    if (scored.length > 0 && scored[0].score > 5) {
      _cachedRoot = scored[0].el;
      _cachedRootUrl = location.href;
      return _cachedRoot;
    }

    // 5. 回退：使用 body
    _cachedRoot = document.body;
    _cachedRootUrl = location.href;
    return document.body;
  }

  /* ===== 行收集（限定在主体内容区域内） ===== */
  function collectLines() {
    const root = detectContentRoot();
    const selector = LINE_SELECTORS.join(',');
    const raw = root.querySelectorAll(selector);
    const seen = new Set();
    const arr = [];

    for (const el of raw) {
      if (seen.has(el)) continue;
      seen.add(el);

      // 过滤不可见
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;

      // 过滤空内容
      if (settings.skipEmpty && !el.textContent.trim()) continue;

      // 过滤极短内容（<3字符，通常是装饰性符号）
      if (el.textContent.trim().length < 3 && el.tagName !== 'PRE') continue;

      arr.push(el);
    }

    // DOM 顺序排序
    arr.sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    // 父子去重
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

  /* =============================================================
   * 滚动引擎
   * ============================================================= */

  /**
   * 滚动到指定元素，兼容嵌套滚动容器。
   * 优先尝试 scrollIntoView，失败时回退到手动计算。
   */
  function scrollToElement(el) {
    // 方式1：原生 scrollIntoView
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      // ignore
    }

    // 方式2：检查元素是否真的进入了视口，如果不在则手动滚动
    // 用 rAF 延迟一帧等待 smooth scroll 启动
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 如果元素已经在视口内（top > -50 且 bottom < vh+50），无需额外操作
      if (rect.top > -50 && rect.bottom < vh + 50) return;

      // 手动计算绝对位置并滚动
      const top = rect.top + window.scrollY;
      const targetY = top - vh / 2 + rect.height / 2;
      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: 'smooth'
      });
    });
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
      _programScroll = true;
      scrollToElement(el);
      // 等 smooth scroll 动画结束再解除标记（通常 800-1200ms）
      setTimeout(() => { _programScroll = false; }, 1200);
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
    if (refresh && currentIndex % 15 === 0) {
      refreshLines();
    }
  }

  function refreshLines() {
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
    if (lines.length === 0) return;
    autoReading = true;
    _lastScrollY = window.scrollY;
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
        _lastScrollY = window.scrollY;
        scheduleNext();
      } else {
        stopAutoRead();
      }
    }, dwellSeconds * 1000);
  }

  /* ===== 高亮开关 ===== */
  function toggleHighlight(forceOn) {
    const shouldActivate = forceOn !== undefined ? forceOn : !highlightActive;

    if (shouldActivate) {
      highlightActive = true;
      _cachedRoot = null; // 重新检测主体内容
      lines = collectLines();
      if (lines.length === 0) {
        highlightActive = false;
        updateIndicator();
        return;
      }

      // 位置恢复
      if (savedUrl === location.href && savedIndex >= 0) {
        const savedSnippet = savedText.slice(0, 80);
        let found = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].textContent.trim().slice(0, 80) === savedSnippet) {
            found = i;
            break;
          }
        }
        if (found === -1 && savedIndex < lines.length) found = savedIndex;
        currentIndex = found >= 0 ? found : 0;
      } else {
        currentIndex = 0;
      }

      applyHighlight(currentIndex);
      savedUrl = location.href;
    } else {
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
    if (autoReading) {
      _lastScrollY = window.scrollY;
      scheduleNext();
    }
  }

  function prevLine() {
    if (!highlightActive) {
      toggleHighlight(true);
      return;
    }
    if (currentIndex > 0) {
      goToLine(currentIndex - 1, false);
    }
    if (autoReading) {
      _lastScrollY = window.scrollY;
      scheduleNext();
    }
  }

  /* =============================================================
   * 手动滚动检测 — 用 rAF 位置对比替代 scroll 事件
   * 彻底避免 scrollIntoView 触发 scroll 事件导致的误中断
   * ============================================================= */
  function scrollCheckLoop() {
    const currentY = window.scrollY;
    const delta = Math.abs(currentY - _lastScrollY);

    if (!_programScroll && autoReading && delta > 80) {
      // 非程序滚动且位移较大 → 用户手动滚动 → 暂停跟读
      stopAutoRead();
    }

    // 非程序滚动期间，持续更新基准位置
    if (!_programScroll) {
      _lastScrollY = currentY;
    }

    requestAnimationFrame(scrollCheckLoop);
  }
  requestAnimationFrame(scrollCheckLoop);

  /* ===== 页面指示器 ===== */
  let indicator = null;

  function createIndicator() {
    if (document.getElementById('har-indicator')) return;

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
      arrow.textContent = '\u25b6';
      text.textContent = '\u8ddf\u8bfb\u4e2d';
      info.textContent =
        (currentIndex + 1) + '/' + lines.length +
        ' \u00b7 ' + dwellSeconds + 's/\u884c';
    } else if (highlightActive) {
      indicator.classList.remove('har-ind-active');
      indicator.classList.add('har-ind-highlight-only');
      arrow.textContent = '\u25c6';
      text.textContent = '\u9ad8\u4eae';
      info.textContent = (currentIndex + 1) + '/' + lines.length;
    } else {
      indicator.classList.remove('har-ind-active');
      indicator.classList.remove('har-ind-highlight-only');
      arrow.textContent = '\u25c7';
      text.textContent = '\u5df2\u6682\u505c';
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
          settings,
          contentRoot: _cachedRoot ? _cachedRoot.tagName.toLowerCase() +
            (_cachedRoot.id ? '#' + _cachedRoot.id : '') : ''
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
        {
          const idx = Math.max(0, Math.min(msg.line - 1, lines.length - 1));
          goToLine(idx, false);
          if (autoReading) {
            _lastScrollY = window.scrollY;
            scheduleNext();
          }
        }
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
    } else if (e.ctrlKey && !e.shiftKey &&
               (e.code === 'ArrowDown' || e.key === 'ArrowDown')) {
      nextLine();
      handled = true;
    } else if (e.ctrlKey && !e.shiftKey &&
               (e.code === 'ArrowUp' || e.key === 'ArrowUp')) {
      prevLine();
      handled = true;
    } else if (e.ctrlKey && e.shiftKey &&
               (e.code === 'KeyL' || e.key === 'L')) {
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

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createIndicator);
    } else {
      createIndicator();
    }
  }

  init();
})();
