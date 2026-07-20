/**
 * AutoTranslate - 侧面板 UI
 * 创建可调节宽度的双语对照翻译面板
 */

window.AutoTranslate = window.AutoTranslate || {};

window.AutoTranslate.Panel = (function() {
  'use strict';

  const AT = window.AutoTranslate;
  const PANEL_MIN_WIDTH = 300;
  const PANEL_MAX_WIDTH = 900;

  let panelContainer = null;
  let shadowRoot = null;
  let panelElement = null;
  let resizeHandle = null;
  let contentArea = null;
  let statusBar = null;
  let isVisible = false;
  let isTranslating = false;
  let currentBlocks = [];

  /**
   * 创建面板 HTML 结构
   */
  function createPanelDOM() {
    // 外层容器（用于定位）
    panelContainer = document.createElement('div');
    panelContainer.id = 'autotranslate-container';

    // Shadow DOM 隔离样式
    shadowRoot = panelContainer.attachShadow({ mode: 'open' });

    // 注入样式
    const style = document.createElement('style');
    style.textContent = getPanelStyles();
    shadowRoot.appendChild(style);

    // 面板主体
    panelElement = document.createElement('div');
    panelElement.className = 'at-panel';
    panelElement.setAttribute('role', 'complementary');
    panelElement.setAttribute('aria-label', '翻译面板');

    // 调整大小手柄
    resizeHandle = document.createElement('div');
    resizeHandle.className = 'at-resize-handle';
    panelElement.appendChild(resizeHandle);

    // 头部
    const header = document.createElement('div');
    header.className = 'at-header';
    header.innerHTML = `
      <div class="at-header-left">
        <svg class="at-logo" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2l1 3M14 13l4 8 4-8M14 13h8M18 21l-4-8"/>
        </svg>
        <span class="at-title">AutoTranslate</span>
      </div>
      <div class="at-header-right">
        <button class="at-btn at-btn-icon" id="btn-scan" title="重新扫描页面">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 4v6h6M23 20v-6h-6"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
        </button>
        <button class="at-btn at-btn-icon" id="btn-settings" title="设置">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button class="at-btn at-btn-icon" id="btn-minimize" title="最小化">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button class="at-btn at-btn-icon" id="btn-close" title="关闭">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
    panelElement.appendChild(header);

    // 操作栏
    const toolbar = document.createElement('div');
    toolbar.className = 'at-toolbar';
    toolbar.innerHTML = `
      <div class="at-lang-select">
        <select id="source-lang">
          <option value="auto">自动检测</option>
          <option value="ZH">中文</option>
          <option value="EN">英语</option>
          <option value="JA">日语</option>
          <option value="KO">韩语</option>
          <option value="FR">法语</option>
          <option value="DE">德语</option>
          <option value="ES">西班牙语</option>
          <option value="RU">俄语</option>
        </select>
        <span class="at-arrow">→</span>
        <select id="target-lang">
          <option value="ZH">中文</option>
          <option value="EN">英语</option>
          <option value="JA">日语</option>
          <option value="KO">韩语</option>
          <option value="FR">法语</option>
          <option value="DE">德语</option>
          <option value="ES">西班牙语</option>
          <option value="RU">俄语</option>
        </select>
      </div>
      <button class="at-btn at-btn-primary" id="btn-translate">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        翻译
      </button>
    `;
    panelElement.appendChild(toolbar);

    // 内容区
    contentArea = document.createElement('div');
    contentArea.className = 'at-content';
    contentArea.innerHTML = `
      <div class="at-empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <p>点击「翻译」按钮开始翻译当前页面内容</p>
        <p class="at-hint">支持网页文章、新闻、博客等内容</p>
      </div>
    `;
    panelElement.appendChild(contentArea);

    // 状态栏
    statusBar = document.createElement('div');
    statusBar.className = 'at-status-bar';
    statusBar.innerHTML = `
      <span class="at-status-text">就绪</span>
      <span class="at-status-right">
        <span class="at-block-count"></span>
        <span class="at-char-count"></span>
      </span>
    `;
    panelElement.appendChild(statusBar);

    shadowRoot.appendChild(panelElement);
    document.body.appendChild(panelContainer);

    // 绑定事件
    bindEvents();
  }

  /**
   * 获取面板样式
   */
  function getPanelStyles() {
    return `
      :host {
        all: initial;
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      }

      .at-panel {
        position: relative;
        height: 100vh;
        width: 420px;
        background: #FFFFFF;
        border-left: 1px solid #E2E8F0;
        box-shadow: -4px 0 24px rgba(0,0,0,0.08);
        display: flex;
        flex-direction: column;
        font-size: 14px;
        color: #1A202C;
        line-height: 1.6;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .at-panel.hidden {
        transform: translateX(100%);
      }

      /* 调整大小手柄 */
      .at-resize-handle {
        position: absolute;
        left: -4px;
        top: 0;
        bottom: 0;
        width: 8px;
        cursor: col-resize;
        z-index: 10;
        transition: background 0.2s;
      }

      .at-resize-handle:hover,
      .at-resize-handle.active {
        background: rgba(66, 133, 244, 0.3);
      }

      .at-resize-handle::after {
        content: '';
        position: absolute;
        left: 3px;
        top: 50%;
        transform: translateY(-50%);
        width: 2px;
        height: 40px;
        background: #CBD5E0;
        border-radius: 2px;
      }

      .at-resize-handle:hover::after {
        background: #4285F4;
      }

      /* 头部 */
      .at-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #1A365D;
        color: white;
        flex-shrink: 0;
      }

      .at-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .at-logo {
        color: #63B3ED;
      }

      .at-title {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: -0.3px;
      }

      .at-header-right {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* 按钮 */
      .at-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
      }

      .at-btn-icon {
        padding: 6px;
        background: transparent;
        color: rgba(255,255,255,0.7);
        border-radius: 6px;
      }

      .at-btn-icon:hover {
        background: rgba(255,255,255,0.15);
        color: white;
      }

      .at-btn-primary {
        background: #4285F4;
        color: white;
        padding: 7px 14px;
      }

      .at-btn-primary:hover {
        background: #3367D6;
      }

      .at-btn-primary:active {
        transform: scale(0.97);
      }

      .at-btn-primary:disabled {
        background: #A0AEC0;
        cursor: not-allowed;
      }

      /* 工具栏 */
      .at-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        background: #F7FAFC;
        border-bottom: 1px solid #E2E8F0;
        flex-shrink: 0;
      }

      .at-lang-select {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .at-lang-select select {
        padding: 5px 8px;
        border: 1px solid #E2E8F0;
        border-radius: 6px;
        font-size: 12px;
        background: white;
        color: #2D3748;
        cursor: pointer;
        font-family: inherit;
      }

      .at-lang-select select:focus {
        outline: none;
        border-color: #4285F4;
      }

      .at-arrow {
        color: #718096;
        font-size: 14px;
      }

      /* 内容区 */
      .at-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        scroll-behavior: smooth;
      }

      .at-content::-webkit-scrollbar {
        width: 6px;
      }

      .at-content::-webkit-scrollbar-track {
        background: transparent;
      }

      .at-content::-webkit-scrollbar-thumb {
        background: #CBD5E0;
        border-radius: 3px;
      }

      .at-content::-webkit-scrollbar-thumb:hover {
        background: #A0AEC0;
      }

      /* 双语卡片 */
      .at-card {
        margin-bottom: 16px;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #E2E8F0;
        transition: box-shadow 0.2s, border-color 0.2s;
      }

      .at-card:hover {
        border-color: #BEE3F8;
        box-shadow: 0 2px 8px rgba(66,133,244,0.08);
      }

      .at-card.highlight {
        border-color: #4285F4;
        box-shadow: 0 0 0 2px rgba(66,133,244,0.15);
      }

      .at-card-heading {
        border-left: 3px solid #4285F4;
      }

      .at-card-quote {
        border-left: 3px solid #48BB78;
      }

      .at-card-code {
        border-left: 3px solid #ED8936;
      }

      /* 原文区域 */
      .at-original {
        padding: 12px 14px;
        background: #F7FAFC;
        border-bottom: 1px solid #EDF2F7;
        position: relative;
      }

      .at-original-text {
        font-size: 14px;
        line-height: 1.7;
        color: #4A5568;
        margin: 0;
        word-break: break-word;
      }

      .at-original-heading {
        font-weight: 600;
        font-size: 15px;
        color: #2D3748;
      }

      .at-lang-badge {
        display: inline-block;
        padding: 1px 6px;
        font-size: 10px;
        font-weight: 600;
        border-radius: 3px;
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .at-lang-badge.zh {
        background: #FED7D7;
        color: #C53030;
      }

      .at-lang-badge.en {
        background: #BEE3F8;
        color: #2B6CB0;
      }

      .at-lang-badge.other {
        background: #E9D8FD;
        color: #6B46C1;
      }

      /* 翻译区域 */
      .at-translation {
        padding: 12px 14px;
        background: #FFFFFF;
        position: relative;
      }

      .at-translation-text {
        font-size: 15px;
        line-height: 1.8;
        color: #1A202C;
        margin: 0;
        word-break: break-word;
      }

      .at-translation-placeholder {
        color: #A0AEC0;
        font-style: italic;
        font-size: 14px;
      }

      /* 操作按钮 */
      .at-card-actions {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.15s;
      }

      .at-card:hover .at-card-actions {
        opacity: 1;
      }

      .at-card-btn {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 4px;
        background: rgba(0,0,0,0.05);
        color: #718096;
        cursor: pointer;
        transition: all 0.15s;
      }

      .at-card-btn:hover {
        background: rgba(66,133,244,0.1);
        color: #4285F4;
      }

      .at-card-btn.copied {
        background: #C6F6D5;
        color: #38A169;
      }

      /* 空状态 */
      .at-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
        color: #718096;
      }

      .at-empty-state p {
        margin: 12px 0 4px;
        font-size: 14px;
      }

      .at-hint {
        font-size: 12px;
        color: #A0AEC0;
      }

      /* 加载状态 */
      .at-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 0;
        color: #4285F4;
        font-size: 13px;
      }

      .at-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #E2E8F0;
        border-top-color: #4285F4;
        border-radius: 50%;
        animation: at-spin 0.8s linear infinite;
      }

      @keyframes at-spin {
        to { transform: rotate(360deg); }
      }

      /* 进度条 */
      .at-progress {
        height: 2px;
        background: #EDF2F7;
        border-radius: 1px;
        overflow: hidden;
        margin: 8px 0;
      }

      .at-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #4285F4, #34A853);
        border-radius: 1px;
        transition: width 0.3s;
      }

      /* 状态栏 */
      .at-status-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 16px;
        background: #F7FAFC;
        border-top: 1px solid #E2E8F0;
        font-size: 11px;
        color: #718096;
        flex-shrink: 0;
      }

      .at-status-right {
        display: flex;
        gap: 12px;
      }

      /* 错误提示 */
      .at-error {
        background: #FFF5F5;
        border: 1px solid #FED7D7;
        border-radius: 8px;
        padding: 12px 14px;
        margin-bottom: 16px;
        color: #C53030;
        font-size: 13px;
      }

      .at-error-title {
        font-weight: 600;
        margin-bottom: 4px;
      }

      /* 翻译完成动画 */
      @keyframes at-fade-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .at-card {
        animation: at-fade-in 0.3s ease-out;
      }

      /* 响应式 */
      @media (max-width: 600px) {
        .at-panel {
          width: 100vw !important;
        }
        .at-resize-handle {
          display: none;
        }
      }

      /* 深色模式 */
      .at-panel.dark {
        background: #1A202C;
        color: #E2E8F0;
      }

      .at-panel.dark .at-header {
        background: #0D1B2A;
      }

      .at-panel.dark .at-toolbar {
        background: #2D3748;
        border-color: #4A5568;
      }

      .at-panel.dark .at-lang-select select {
        background: #2D3748;
        border-color: #4A5568;
        color: #E2E8F0;
      }

      .at-panel.dark .at-card {
        border-color: #4A5568;
      }

      .at-panel.dark .at-original {
        background: #2D3748;
        border-color: #4A5568;
      }

      .at-panel.dark .at-original-text {
        color: #CBD5E0;
      }

      .at-panel.dark .at-translation {
        background: #1A202C;
      }

      .at-panel.dark .at-translation-text {
        color: #E2E8F0;
      }

      .at-panel.dark .at-status-bar {
        background: #2D3748;
        border-color: #4A5568;
      }

      .at-panel.dark .at-empty-state {
        color: #A0AEC0;
      }

      .at-panel.dark .at-content::-webkit-scrollbar-thumb {
        background: #4A5568;
      }
    `;
  }

  /**
   * 绑定面板事件
   */
  function bindEvents() {
    const $ = (id) => shadowRoot.getElementById(id);

    // 关闭按钮
    $('btn-close').addEventListener('click', () => toggle(false));

    // 最小化按钮
    $('btn-minimize').addEventListener('click', () => {
      panelElement.style.transform = 'translateX(calc(100% - 40px))';
      setTimeout(() => {
        panelElement.style.transform = '';
        toggle(false);
      }, 300);
    });

    // 翻译按钮
    $('btn-translate').addEventListener('click', () => startTranslation());

    // 重新扫描
    $('btn-scan').addEventListener('click', () => {
      scanPage();
    });

    // 设置按钮
    $('btn-settings').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // 语言切换
    $('source-lang').addEventListener('change', (e) => {
      AT.Settings.save({ sourceLang: e.target.value });
    });

    $('target-lang').addEventListener('change', (e) => {
      AT.Settings.save({ targetLang: e.target.value });
    });

    // 调整大小
    setupResize();
  }

  /**
   * 设置拖拽调整宽度
   */
  function setupResize() {
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startWidth = panelElement.offsetWidth;
      resizeHandle.classList.add('active');
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const diff = startX - e.clientX;
      const newWidth = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, startWidth + diff));
      panelElement.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      resizeHandle.classList.remove('active');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      // 保存宽度
      const finalWidth = panelElement.offsetWidth;
      AT.Settings.save({ panelWidth: finalWidth });
    });
  }

  /**
   * 切换面板显示
   */
  function toggle(show) {
    if (!panelContainer) {
      createPanelDOM();
    }

    if (show === undefined) {
      isVisible = !isVisible;
    } else {
      isVisible = show;
    }

    if (isVisible) {
      panelContainer.style.display = 'block';
      requestAnimationFrame(() => {
        panelElement.classList.remove('hidden');
      });
      // 调整页面内容区域，避免被面板遮挡
      adjustPageLayout();
    } else {
      panelElement.classList.add('hidden');
      setTimeout(() => {
        panelContainer.style.display = 'none';
      }, 300);
      // 恢复页面布局
      restorePageLayout();
    }

    return isVisible;
  }

  /**
   * 调整页面布局以适应面板
   */
  function adjustPageLayout() {
    const panelWidth = panelElement.offsetWidth;
    document.documentElement.style.marginRight = panelWidth + 'px';
    document.documentElement.style.transition = 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  }

  /**
   * 恢复页面布局
   */
  function restorePageLayout() {
    document.documentElement.style.marginRight = '';
  }

  /**
   * 扫描页面内容
   */
  function scanPage() {
    const result = AT.Extractor.extract();
    currentBlocks = result.blocks;

    // 更新状态栏
    updateStatus(`发现 ${result.totalCount} 个内容块`, result.totalChars);

    // 更新语言选择
    const sourceLangSelect = shadowRoot.getElementById('source-lang');
    const targetLangSelect = shadowRoot.getElementById('target-lang');

    if (result.detectedLang === 'ZH') {
      sourceLangSelect.value = 'ZH';
      targetLangSelect.value = 'EN';
    } else if (result.detectedLang === 'EN') {
      sourceLangSelect.value = 'EN';
      targetLangSelect.value = 'ZH';
    }

    // 显示扫描结果
    if (currentBlocks.length === 0) {
      contentArea.innerHTML = `
        <div class="at-empty-state">
          <p>未找到可翻译的内容</p>
          <p class="at-hint">请确保页面包含文章或正文内容</p>
        </div>
      `;
    } else {
      showScannedBlocks(currentBlocks);
    }

    return result;
  }

  /**
   * 显示扫描到的内容块（待翻译状态）
   */
  function showScannedBlocks(blocks) {
    contentArea.innerHTML = '';

    blocks.forEach(block => {
      const card = createCard(block);
      contentArea.appendChild(card);
    });

    // 显示翻译按钮提示
    const hint = document.createElement('div');
    hint.className = 'at-loading';
    hint.style.justifyContent = 'center';
    hint.innerHTML = `<span>共 ${blocks.length} 段内容，点击「翻译」开始</span>`;
    contentArea.appendChild(hint);
  }

  /**
   * 创建双语卡片
   */
  function createCard(block, translation) {
    const card = document.createElement('div');
    card.className = 'at-card';
    card.dataset.blockId = block.id;

    // 根据类型添加样式
    if (block.type === 'heading') card.classList.add('at-card-heading');
    else if (block.type === 'quote') card.classList.add('at-card-quote');
    else if (block.type === 'code-block') card.classList.add('at-card-code');

    // 判断语言
    const lang = detectBlockLang(block.text);
    const langBadgeClass = lang === 'ZH' ? 'zh' : lang === 'EN' ? 'en' : 'other';
    const langLabel = lang === 'ZH' ? '中文' : lang === 'EN' ? 'EN' : lang;

    // 原文区域
    const originalDiv = document.createElement('div');
    originalDiv.className = 'at-original';
    originalDiv.innerHTML = `
      <span class="at-lang-badge ${langBadgeClass}">${langLabel}</span>
      <div class="at-original-text ${block.type === 'heading' ? 'at-original-heading' : ''}">${escapeHtml(block.text)}</div>
      <div class="at-card-actions">
        <button class="at-card-btn" data-action="copy-original" title="复制原文">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
    `;

    // 翻译区域
    const translationDiv = document.createElement('div');
    translationDiv.className = 'at-translation';

    if (translation && translation.translatedText) {
      const targetLangBadge = translation.targetLang === 'ZH' ? 'zh' : translation.targetLang === 'EN' ? 'en' : 'other';
      const targetLangLabel = translation.targetLang === 'ZH' ? '中文' : translation.targetLang === 'EN' ? 'EN' : translation.targetLang;
      translationDiv.innerHTML = `
        <span class="at-lang-badge ${targetLangBadge}">${targetLangLabel}</span>
        <div class="at-translation-text">${escapeHtml(translation.translatedText)}</div>
        <div class="at-card-actions">
          <button class="at-card-btn" data-action="copy-translation" title="复制译文">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
      `;
    } else if (translation && translation.error) {
      translationDiv.innerHTML = `
        <div class="at-translation-text" style="color: #E53E3E;">翻译失败: ${escapeHtml(translation.error)}</div>
      `;
    } else {
      translationDiv.innerHTML = `
        <div class="at-translation-text at-translation-placeholder">等待翻译...</div>
      `;
    }

    card.appendChild(originalDiv);
    card.appendChild(translationDiv);

    // 绑定复制事件
    card.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        let text = '';
        if (action === 'copy-original') text = block.text;
        else if (action === 'copy-translation' && translation) text = translation.translatedText;

        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 1500);
          });
        }
      });
    });

    // 悬停高亮对应原文
    const settings = AT.Settings.getAll();
    if (settings.highlightOnHover && block.element) {
      card.addEventListener('mouseenter', () => {
        block.element.style.outline = '2px solid #4285F4';
        block.element.style.outlineOffset = '2px';
        block.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight');
      });
      card.addEventListener('mouseleave', () => {
        block.element.style.outline = '';
        block.element.style.outlineOffset = '';
        card.classList.remove('highlight');
      });
    }

    return card;
  }

  /**
   * 更新已有卡片的翻译内容
   */
  function updateCardTranslation(blockId, translation) {
    const card = shadowRoot.querySelector(`[data-block-id="${blockId}"]`);
    if (!card) return;

    const translationDiv = card.querySelector('.at-translation');
    if (!translationDiv) return;

    if (translation.translatedText) {
      const targetLangBadge = translation.targetLang === 'ZH' ? 'zh' : translation.targetLang === 'EN' ? 'en' : 'other';
      const targetLangLabel = translation.targetLang === 'ZH' ? '中文' : translation.targetLang === 'EN' ? 'EN' : translation.targetLang;
      translationDiv.innerHTML = `
        <span class="at-lang-badge ${targetLangBadge}">${targetLangLabel}</span>
        <div class="at-translation-text">${escapeHtml(translation.translatedText)}</div>
        <div class="at-card-actions">
          <button class="at-card-btn" data-action="copy-translation" title="复制译文">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
      `;

      // 绑定复制
      const copyBtn = translationDiv.querySelector('[data-action="copy-translation"]');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(translation.translatedText).then(() => {
            copyBtn.classList.add('copied');
            setTimeout(() => copyBtn.classList.remove('copied'), 1500);
          });
        });
      }
    } else if (translation.error) {
      translationDiv.innerHTML = `
        <div class="at-translation-text" style="color: #E53E3E;">翻译失败: ${escapeHtml(translation.error)}</div>
      `;
    }
  }

  /**
   * 检测单个文本块的语言
   */
  function detectBlockLang(text) {
    const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const totalAlpha = (text.match(/[a-zA-Z\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    if (totalAlpha === 0) return '?';
    const ratio = chineseChars / totalAlpha;
    if (ratio > 0.3) return 'ZH';
    if (ratio < 0.05) return 'EN';
    return '?';
  }

  /**
   * 开始翻译流程
   */
  async function startTranslation() {
    if (isTranslating) return;

    // 检查 API Key
    if (!AT.Settings.isConfigured()) {
      showError('请先配置 DeepL API Key', '点击右上角设置按钮，进入设置页面配置 API Key。');
      return;
    }

    // 如果还没有扫描内容，先扫描
    if (currentBlocks.length === 0) {
      scanPage();
    }

    if (currentBlocks.length === 0) {
      showError('无可翻译的内容', '页面中未找到文章或正文内容。');
      return;
    }

    isTranslating = true;
    const translateBtn = shadowRoot.getElementById('btn-translate');
    translateBtn.disabled = true;
    translateBtn.innerHTML = '<div class="at-spinner"></div> 翻译中...';

    const settings = AT.Settings.getAll();
    const sourceLang = shadowRoot.getElementById('source-lang').value;
    const targetLang = shadowRoot.getElementById('target-lang').value;

    // 加载缓存
    await AT.Cache.loadCache();

    // 检查缓存
    const texts = currentBlocks.map(b => b.text);
    const cacheResult = AT.Cache.getBatch(texts, sourceLang, targetLang);

    // 显示缓存命中的翻译
    cacheResult.hits.forEach(hit => {
      const block = currentBlocks[hit.index];
      updateCardTranslation(block.id, {
        translatedText: hit.translatedText,
        targetLang: targetLang
      });
    });

    // 翻译缓存未命中的部分
    if (cacheResult.misses.length > 0) {
      const missBlocks = cacheResult.misses.map(m => ({
        id: currentBlocks[m.index].id,
        text: m.text
      }));

      // 添加进度条
      const progressBar = document.createElement('div');
      progressBar.className = 'at-progress';
      progressBar.innerHTML = '<div class="at-progress-bar" style="width: 0%"></div>';
      contentArea.appendChild(progressBar);

      try {
        const results = await AT.Translator.translateBlocks(
          missBlocks,
          sourceLang,
          targetLang,
          (translated, total) => {
            // 更新进度条
            const pct = Math.round((translated / total) * 100);
            const bar = progressBar.querySelector('.at-progress-bar');
            if (bar) bar.style.width = pct + '%';
            updateStatus(`翻译中... ${translated}/${total}`, null);
          },
          (result) => {
            // 单个块翻译完成
            updateCardTranslation(result.id, result);
            // 缓存结果
            if (result.translatedText) {
              AT.Cache.set(result.originalText, result.translatedText, sourceLang, targetLang);
            }
          }
        );

        // 移除进度条
        progressBar.remove();

      } catch (error) {
        progressBar.remove();
        showError('翻译出错', error.message);
      }
    }

    isTranslating = false;
    translateBtn.disabled = false;
    translateBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      翻译
    `;

    // 更新状态
    const stats = AT.Cache.getStats();
    updateStatus('翻译完成', null, currentBlocks.length);
  }

  /**
   * 显示错误信息
   */
  function showError(title, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'at-error';
    errorDiv.innerHTML = `
      <div class="at-error-title">${escapeHtml(title)}</div>
      <div>${escapeHtml(message)}</div>
    `;
    contentArea.insertBefore(errorDiv, contentArea.firstChild);

    // 5秒后自动消失
    setTimeout(() => {
      errorDiv.style.opacity = '0';
      errorDiv.style.transition = 'opacity 0.3s';
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  }

  /**
   * 更新状态栏
   */
  function updateStatus(text, charCount, blockCount) {
    const statusText = statusBar.querySelector('.at-status-text');
    const blockCountEl = statusBar.querySelector('.at-block-count');
    const charCountEl = statusBar.querySelector('.at-char-count');

    if (text) statusText.textContent = text;
    if (blockCount !== undefined && blockCount !== null) {
      blockCountEl.textContent = `${blockCount} 段`;
    }
    if (charCount !== undefined && charCount !== null) {
      charCountEl.textContent = `~${Math.round(charCount / 1000)}k 字符`;
    }
  }

  /**
   * 显示空状态
   */
  function showEmptyState(message, hint) {
    contentArea.innerHTML = `
      <div class="at-empty-state">
        <p>${escapeHtml(message)}</p>
        ${hint ? `<p class="at-hint">${escapeHtml(hint)}</p>` : ''}
      </div>
    `;
  }

  /**
   * HTML 转义
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 获取面板状态
   */
  function getState() {
    return {
      isVisible: isVisible,
      isTranslating: isTranslating,
      blockCount: currentBlocks.length
    };
  }

  return {
    toggle: toggle,
    scanPage: scanPage,
    startTranslation: startTranslation,
    getState: getState,
    showEmptyState: showEmptyState,
    showError: showError
  };
})();
