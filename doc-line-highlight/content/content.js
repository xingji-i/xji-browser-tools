/**
 * Doc Line Highlight - content.js
 * 逐行高亮引擎：抓取页面文本行 → 快捷键跳转 → 高亮 + 滚动居中
 *
 * 适配场景：
 *   1. 网页 Markdown（GitHub / 语雀 / Obsidian 等 .markdown-body 容器）
 *   2. PDF.js 渲染的 PDF（.textLayer span / .text-item）
 *   3. 通用网页文章（article、main、.post-content 等容器内的段落）
 *   4. 代码块行（pre > code 内的 .code-line / 行号）
 */

(() => {
  "use strict";

  /* ─── 状态 ─── */
  let lineElements = [];      // 当前页面所有可高亮行
  let currentIndex = -1;      // 当前高亮行索引
  let active = false;         // 高亮模式是否开启
  let settings = {
    highlightColor: "#fff3b0",
    outlineColor: "#ffb300",
    skipEmpty: true,          // 跳过空行
    fontSize: "inherit",
    autoScroll: true,         // 自动滚动居中
    scrollBehavior: "smooth",
  };

  const CLASS_NAME = "dlh-highlight";

  /* ─── 行选择器 ─── */
  // 按优先级排列，匹配到第一组非空结果即停止
  const LINE_SELECTORS = [
    // PDF.js 文本层
    ".textLayer span",
    ".pdfViewer .text-item",
    // Markdown 渲染
    ".markdown-body p",
    ".markdown-body li",
    ".markdown-body h1", ".markdown-body h2", ".markdown-body h3",
    ".markdown-body h4", ".markdown-body h5", ".markdown-body h6",
    ".markdown-body blockquote p",
    ".markdown-body .highlight pre code .code-line",
    // GitHub code view
    ".js-file-line",
    ".blob-code-inner",
    // 通用文章容器
    "article p",
    "article li",
    "article h1", "article h2", "article h3",
    "main p",
    "main li",
    ".post-content p",
    ".post-content li",
    ".article-content p",
    // 代码块
    "pre code .code-line",
    // 通用段落（兜底）
    "p",
    "li",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote",
    "td",
    "dt", "dd",
  ];

  /* ─── 核心：抓取所有文本行 ─── */
  function collectLines() {
    // 策略：用所有选择器一次查询，按 DOM 顺序排列，去重
    const selectorStr = LINE_SELECTORS.join(", ");
    const allEls = Array.from(document.querySelectorAll(selectorStr));

    // 去重（一个元素可能匹配多个选择器）
    const seen = new Set();
    const unique = [];
    for (const el of allEls) {
      if (seen.has(el)) continue;
      seen.add(el);
      unique.push(el);
    }

    // 按 DOM 树序排列（document position）
    unique.sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    // 过滤不可见 / 空文本
    return unique.filter((el) => {
      const text = el.textContent.trim();
      if (settings.skipEmpty && text === "") return false;
      // 过滤不可见元素
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
  }

  /* ─── 高亮操作 ─── */
  function clearHighlight() {
    const old = document.querySelector(`.${CLASS_NAME}`);
    if (old) old.classList.remove(CLASS_NAME);
  }

  function applyHighlight() {
    clearHighlight();
    if (currentIndex < 0 || currentIndex >= lineElements.length) return;

    const target = lineElements[currentIndex];
    target.classList.add(CLASS_NAME);

    // 动态设置高亮颜色（从 settings 读取）
    target.style.setProperty("--dlh-bg", settings.highlightColor);
    target.style.setProperty("--dlh-outline", settings.outlineColor);

    // 自动滚动居中
    if (settings.autoScroll) {
      target.scrollIntoView({
        behavior: settings.scrollBehavior,
        block: "center",
      });
    }

    // 通知 popup 更新状态
    sendStatusToPopup();
  }

  /* ─── 导航 ─── */
  function goToNextLine() {
    if (!active) return;
    refreshIfNeeded();
    if (lineElements.length === 0) return;
    currentIndex = Math.min(currentIndex + 1, lineElements.length - 1);
    applyHighlight();
  }

  function goToPrevLine() {
    if (!active) return;
    refreshIfNeeded();
    if (lineElements.length === 0) return;
    currentIndex = Math.max(currentIndex - 1, 0);
    applyHighlight();
  }

  /** 页面可能动态加载内容，每 10 次导航刷新一次行列表 */
  let navCount = 0;
  function refreshIfNeeded() {
    navCount++;
    if (navCount % 10 === 0) {
      const oldLen = lineElements.length;
      lineElements = collectLines();
      // 如果行数变化，修正索引
      if (currentIndex >= lineElements.length) {
        currentIndex = lineElements.length - 1;
      }
    }
  }

  /* ─── 开关 ─── */
  function toggle() {
    active = !active;
    if (active) {
      lineElements = collectLines();
      if (lineElements.length > 0 && currentIndex < 0) {
        currentIndex = 0;
      }
      applyHighlight();
    } else {
      clearHighlight();
      currentIndex = -1;
    }
    sendStatusToPopup();
  }

  /* ─── 快捷键监听（双重保障：manifest commands + content keydown） ─── */
  // manifest commands 通过 background 转发 message
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "DLH_COMMAND") {
      if (msg.command === "next-line") goToNextLine();
      else if (msg.command === "prev-line") goToPrevLine();
      else if (msg.command === "toggle-highlight") toggle();
      sendResponse({ ok: true });
    }
    if (msg.type === "DLH_GET_STATUS") {
      sendResponse(getStatus());
    }
    if (msg.type === "DLH_UPDATE_SETTINGS") {
      Object.assign(settings, msg.settings);
      // 如果已激活，重新应用颜色
      if (active && currentIndex >= 0) {
        applyHighlight();
      }
      sendResponse({ ok: true });
    }
    if (msg.type === "DLH_GOTO_LINE") {
      if (!active) {
        active = true;
        lineElements = collectLines();
      }
      const lineNum = parseInt(msg.line, 10);
      if (lineNum >= 1 && lineNum <= lineElements.length) {
        currentIndex = lineNum - 1;
        applyHighlight();
      }
      sendResponse({ ok: true, total: lineElements.length });
    }
  });

  // content script 层 keydown 兜底（某些页面 manifest commands 不触发）
  document.addEventListener("keydown", (e) => {
    if (!active) return;

    // Ctrl + ↓
    if (e.ctrlKey && (e.key === "ArrowDown" || e.code === "ArrowDown")) {
      e.preventDefault();
      goToNextLine();
    }
    // Ctrl + ↑
    if (e.ctrlKey && (e.key === "ArrowUp" || e.code === "ArrowUp")) {
      e.preventDefault();
      goToPrevLine();
    }
    // Ctrl + Shift + L → 切换
    if (e.ctrlKey && e.shiftKey && (e.key === "L" || e.code === "KeyL")) {
      e.preventDefault();
      toggle();
    }
    // Escape → 关闭高亮
    if (e.key === "Escape") {
      if (active) {
        e.preventDefault();
        toggle();
      }
    }
  }, true); // capture phase 确保在页面 JS 之前拦截

  /* ─── 状态查询 ─── */
  function getStatus() {
    return {
      active,
      currentIndex: currentIndex + 1, // 1-based 显示
      totalLines: lineElements.length,
      currentText: currentIndex >= 0 && currentIndex < lineElements.length
        ? lineElements[currentIndex].textContent.trim().slice(0, 80)
        : "",
    };
  }

  function sendStatusToPopup() {
    // popup 通过 message 轮询，无需主动推送
  }

  /* ─── 加载设置 ─── */
  chrome.storage.local.get(["dlh_settings"], (result) => {
    if (result.dlh_settings) {
      Object.assign(settings, result.dlh_settings);
    }
  });

  /* ─── 页面动态内容监听（MutationObserver） ─── */
  // 某些 SPA 页面会异步加载内容，监听 DOM 变化以更新行列表
  const observer = new MutationObserver((mutations) => {
    if (!active) return;
    let hasNewNodes = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        hasNewNodes = true;
        break;
      }
    }
    if (hasNewNodes) {
      // 延迟刷新，等 DOM 稳定
      setTimeout(() => {
        const oldLen = lineElements.length;
        lineElements = collectLines();
      }, 300);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  /* ─── 初始状态通知 ─── */
  console.log("[Doc Line Highlight] 已加载，按 Ctrl+Shift+L 开启逐行高亮");
})();
