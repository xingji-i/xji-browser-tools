/**
 * AutoTranslate - 主内容脚本
 * 协调各模块，处理消息通信，管理浮动按钮
 */

(function() {
  'use strict';

  // 防止重复注入
  if (window.__AutoTranslateLoaded) return;
  window.__AutoTranslateLoaded = true;

  const AT = window.AutoTranslate;

  // ========== 初始化 ==========

  async function init() {
    // 加载设置
    await AT.Settings.load();

    // 创建浮动按钮
    createFloatingButton();

    // 监听来自 background/popup 的消息
    setupMessageListener();

    // 监听设置变更
    AT.Settings.onChange((changed) => {
      if (changed.theme) {
        applyTheme(changed.theme);
      }
    });

    // 应用主题
    applyTheme(AT.Settings.get('theme'));

    console.log('[AutoTranslate] 已加载');
  }

  // ========== 浮动按钮 ==========

  function createFloatingButton() {
    // 避免在某些页面显示（如 chrome:// 页面）
    if (window.location.protocol === 'chrome:' ||
        window.location.protocol === 'chrome-extension:' ||
        window.location.protocol === 'about:') {
      return;
    }

    const fab = document.createElement('button');
    fab.id = 'autotranslate-fab';
    fab.title = 'AutoTranslate (Alt+T)';
    fab.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2l1 3"/>
        <path d="M14 13l4 8 4-8M14 13h8"/>
      </svg>
    `;

    fab.addEventListener('click', () => {
      const isVisible = AT.Panel.toggle();
      fab.classList.toggle('hidden', isVisible);
    });

    document.body.appendChild(fab);

    // 拖拽功能
    let isDragging = false;
    let hasMoved = false;
    let dragStartX, dragStartY, btnStartX, btnStartY;

    fab.addEventListener('mousedown', (e) => {
      isDragging = true;
      hasMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      btnStartX = fab.offsetLeft;
      btnStartY = fab.offsetTop;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMoved = true;
        fab.style.left = (btnStartX + dx) + 'px';
        fab.style.top = (btnStartY + dy) + 'px';
        fab.style.right = 'auto';
        fab.style.bottom = 'auto';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      if (hasMoved) {
        // 吸附到最近的边
        const rect = fab.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        if (centerX > window.innerWidth / 2) {
          fab.style.left = 'auto';
          fab.style.right = '24px';
        } else {
          fab.style.right = 'auto';
          fab.style.left = '24px';
        }
      }
    });

    // 覆盖默认的 click 行为（拖拽时不触发）
    fab.addEventListener('click', (e) => {
      if (hasMoved) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  }

  // ========== 消息通信 ==========

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'TOGGLE_PANEL':
          const visible = AT.Panel.toggle();
          sendResponse({ visible });
          break;

        case 'START_TRANSLATE':
          AT.Panel.toggle(true);
          // 延迟一帧确保面板已显示
          requestAnimationFrame(() => {
            AT.Panel.scanPage();
            AT.Panel.startTranslation();
          });
          sendResponse({ started: true });
          break;

        case 'GET_STATE':
          sendResponse(AT.Panel.getState());
          break;

        case 'SCAN_PAGE':
          AT.Panel.toggle(true);
          const result = AT.Panel.scanPage();
          sendResponse({
            blockCount: result.totalCount,
            detectedLang: result.detectedLang
          });
          break;

        default:
          break;
      }
      return false;
    });
  }

  // ========== 快捷键 ==========

  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    // Alt+T 切换面板
    if (e.altKey && !e.shiftKey && key === 't') {
      e.preventDefault();
      AT.Panel.toggle();
    }
    // Alt+Shift+T 翻译页面
    if (e.altKey && e.shiftKey && key === 't') {
      e.preventDefault();
      AT.Panel.toggle(true);
      requestAnimationFrame(() => {
        AT.Panel.scanPage();
        AT.Panel.startTranslation();
      });
    }
  });

  // ========== 主题 ==========

  function applyTheme(theme) {
    const fab = document.getElementById('autotranslate-fab');
    if (!fab) return;

    if (theme === 'dark') {
      fab.style.background = 'linear-gradient(135deg, #4A5568, #2D3748)';
    } else if (theme === 'light') {
      fab.style.background = 'linear-gradient(135deg, #4285F4, #1A73E8)';
    } else {
      // auto - 根据系统偏好
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      fab.style.background = prefersDark
        ? 'linear-gradient(135deg, #4A5568, #2D3748)'
        : 'linear-gradient(135deg, #4285F4, #1A73E8)';
    }
  }

  // ========== 自动翻译（可选） ==========

  async function checkAutoTranslate() {
    const settings = AT.Settings.getAll();
    if (!settings.autoTranslate) return;
    if (!AT.Settings.isConfigured()) return;

    // 避免在特殊页面自动翻译
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;

    // 等待页面加载完成
    if (document.readyState !== 'complete') {
      await new Promise(resolve => {
        window.addEventListener('load', resolve, { once: true });
      });
    }

    // 额外等待，确保动态内容加载
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 提取并检查内容量
    const result = AT.Extractor.extract();
    if (result.totalChars > 0 && result.totalChars <= settings.maxAutoTranslateChars) {
      AT.Panel.toggle(true);
      AT.Panel.scanPage();
      AT.Panel.startTranslation();
    }
  }

  // ========== 启动 ==========

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      checkAutoTranslate();
    });
  } else {
    init();
    checkAutoTranslate();
  }
})();
