/**
 * content.js — 自动翻页核心滚动逻辑
 * 注入到每个网页，负责：
 *   1. 基于 requestAnimationFrame 的平滑自动滚动（支持亚像素级慢速）
 *   2. 响应来自 popup / background 的控制消息
 *   3. 在页面上显示悬浮状态指示器
 *   4. 页面级键盘快捷键监听（作为 commands API 的兜底）
 */

(() => {
  "use strict";

  // ─── 状态 ───────────────────────────────────────────────────
  let isScrolling = false;
  let speed = 0.4;         // 像素/帧 (0.1~3.0)
  let direction = "down";  // "up" | "down"
  let smooth = true;
  let animFrameId = null;
  let scrollAccumulator = 0; // 亚像素累积器

  // ─── 悬浮指示器 ─────────────────────────────────────────────
  const indicator = document.createElement("div");
  indicator.id = "auto-scroll-indicator";
  Object.assign(indicator.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "2147483647",
    display: "none",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.92)",
    color: "#555",
    fontSize: "12px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    backdropFilter: "blur(6px)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 1px 8px rgba(0,0,0,0.08)",
    cursor: "pointer",
    userSelect: "none",
    transition: "opacity 0.2s",
    opacity: "0.9"
  });
  indicator.addEventListener("mouseenter", () => (indicator.style.opacity = "1"));
  indicator.addEventListener("mouseleave", () => (indicator.style.opacity = "0.9"));
  indicator.addEventListener("click", () => toggleScroll());

  const arrowSpan = document.createElement("span");
  arrowSpan.style.fontSize = "14px";
  arrowSpan.style.lineHeight = "1";
  arrowSpan.style.color = "#8a7e6b";
  indicator.appendChild(arrowSpan);

  const textSpan = document.createElement("span");
  textSpan.style.color = "#666";
  indicator.appendChild(textSpan);

  const speedSpan = document.createElement("span");
  speedSpan.style.opacity = "0.5";
  speedSpan.style.fontSize = "11px";
  indicator.appendChild(speedSpan);

  document.documentElement.appendChild(indicator);

  // ─── 滚动核心（支持亚像素） ────────────────────────────────
  function scrollStep() {
    if (!isScrolling) return;

    // 亚像素累积：当速度 < 1 时，累积到整数再滚动
    scrollAccumulator += speed;
    const intDelta = Math.floor(scrollAccumulator);
    scrollAccumulator -= intDelta;

    if (intDelta > 0) {
      const delta = direction === "down" ? intDelta : -intDelta;
      window.scrollBy(0, delta);
    }

    // 检测是否到达页面底部/顶部，自动停止
    const atBottom = direction === "down" &&
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
    const atTop = direction === "up" && window.scrollY <= 0;

    if (atBottom || atTop) {
      stopScroll();
      return;
    }

    animFrameId = requestAnimationFrame(scrollStep);
  }

  function startScroll() {
    if (isScrolling) return;
    isScrolling = true;
    scrollAccumulator = 0;
    animFrameId = requestAnimationFrame(scrollStep);
    updateIndicator();
  }

  function stopScroll() {
    isScrolling = false;
    scrollAccumulator = 0;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    updateIndicator();
  }

  function toggleScroll() {
    isScrolling ? stopScroll() : startScroll();
  }

  function reverseDirection() {
    direction = direction === "down" ? "up" : "down";
    updateIndicator();
    const browser = typeof globalThis.browser !== "undefined" ? globalThis.browser : chrome;
    browser.storage.local.set({ scrollSettings: { speed, direction, smooth } });
  }

  // ─── 格式化速度显示 ────────────────────────────────────────
  function formatSpeed(s) {
    if (s < 1) return s.toFixed(1);
    if (s === Math.floor(s)) return s.toString();
    return s.toFixed(1);
  }

  // ─── 指示器 UI 更新 ─────────────────────────────────────────
  function updateIndicator() {
    if (isScrolling) {
      indicator.style.display = "flex";
      arrowSpan.textContent = direction === "down" ? "↓" : "↑";
      textSpan.textContent = direction === "down" ? "向下滚动中" : "向上滚动中";
      speedSpan.textContent = `×${formatSpeed(speed)}`;
    } else {
      indicator.style.display = "none";
    }
  }

  // ─── 消息监听 ───────────────────────────────────────────────
  const browser = typeof globalThis.browser !== "undefined" ? globalThis.browser : chrome;

  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.action) {
      case "toggle":
        toggleScroll();
        break;
      case "start":
        startScroll();
        break;
      case "stop":
        stopScroll();
        break;
      case "reverse":
        reverseDirection();
        break;
      case "setSpeed":
        speed = Math.max(0.1, Math.min(3.0, Number(msg.speed) || 0.4));
        updateIndicator();
        break;
      case "setDirection":
        direction = msg.direction === "up" ? "up" : "down";
        updateIndicator();
        break;
      case "getState":
        sendResponse({
          isScrolling,
          speed,
          direction,
          smooth
        });
        return true; // 异步响应
      case "applySettings":
        speed = msg.speed ?? speed;
        direction = msg.direction ?? direction;
        smooth = msg.smooth ?? smooth;
        updateIndicator();
        break;
    }
    sendResponse({ isScrolling, speed, direction, smooth });
    return false;
  });

  // ─── 页面级键盘快捷键（数字键盘） ───────────────────────────
  document.addEventListener("keydown", (e) => {
    // 忽略输入框内的按键
    const tag = e.target.tagName;
    const isEditable = e.target.isContentEditable ||
      tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (isEditable) return;

    // 仅响应小键盘（event.code 区分 Numpad 和主键盘数字）
    switch (e.code) {
      case "Numpad0":
        e.preventDefault();
        toggleScroll();
        break;
      case "Numpad8":
        e.preventDefault();
        if (direction !== "up") {
          direction = "up";
          updateIndicator();
          browser.storage.local.set({ scrollSettings: { speed, direction, smooth } });
        }
        if (!isScrolling) startScroll();
        break;
      case "Numpad2":
        e.preventDefault();
        if (direction !== "down") {
          direction = "down";
          updateIndicator();
          browser.storage.local.set({ scrollSettings: { speed, direction, smooth } });
        }
        if (!isScrolling) startScroll();
        break;
      case "NumpadAdd":
        e.preventDefault();
        speed = Math.min(3.0, +(speed + 0.2).toFixed(1));
        updateIndicator();
        browser.storage.local.set({ scrollSettings: { speed, direction, smooth } });
        break;
      case "NumpadSubtract":
        e.preventDefault();
        speed = Math.max(0.1, +(speed - 0.2).toFixed(1));
        updateIndicator();
        browser.storage.local.set({ scrollSettings: { speed, direction, smooth } });
        break;
    }
  });

  // ─── 初始化：从 storage 加载设置 ────────────────────────────
  browser.storage.local.get("scrollSettings", (result) => {
    const s = result.scrollSettings;
    if (s) {
      speed = s.speed ?? 0.4;
      direction = s.direction ?? "down";
      smooth = s.smooth ?? true;
    }
  });
})();
