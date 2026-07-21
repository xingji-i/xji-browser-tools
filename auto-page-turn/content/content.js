/**
 * content.js — 自动翻页核心滚动逻辑
 * 注入到每个网页，负责：
 *   1. 基于 requestAnimationFrame 的平滑自动滚动（浮点理想位置 + 帧率无关）
 *   2. 响应来自 popup / background 的控制消息
 *   3. 在页面上显示悬浮状态指示器
 *   4. 页面级键盘快捷键监听（作为 commands API 的兜底）
 */

(() => {
  "use strict";

  // ─── 状态 ───────────────────────────────────────────────────
  let isScrolling = false;
  let speed = 0.4;         // 像素/帧 (0.1~3.0)，内部会转换为 px/s
  let direction = "down";  // "up" | "down"
  let smooth = true;
  let animFrameId = null;
  let idealScrollY = 0;    // 浮点理想滚动位置，消除整数步进抖动
  let lastFrameTime = 0;   // 上一帧时间戳，用于帧率无关速度计算

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

  // ─── 滚动核心（浮点理想位置 + 帧率无关） ────────────────────
  // 优化说明：
  //   旧方案用 Math.floor 累积整数像素再 scrollBy，导致帧间步进不均匀
  //   （如速度1.4时步进模式为 1-1-2-1-1-2...），在大屏/高刷上产生明显抖动。
  //   新方案：
  //     1. 维护浮点 idealScrollY，每帧用 scrollTo 定位到精确位置
  //     2. 速度按时间（px/s）而非帧数计算，60Hz/120Hz/144Hz 表现一致
  //     3. 检测用户手动滚动，自动重新同步避免位置漂移
  function scrollStep(timestamp) {
    if (!isScrolling) return;

    // 首帧初始化时间戳
    if (!lastFrameTime) {
      lastFrameTime = timestamp;
      animFrameId = requestAnimationFrame(scrollStep);
      return;
    }

    // 计算帧间隔（秒），上限 100ms 防止切标签页后大跳
    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
    lastFrameTime = timestamp;

    // 帧率无关：speed(px/frame) × 60 = px/s，再乘以 dt 得到本帧位移
    const delta = speed * 60 * dt;

    // 检测用户手动滚动（非程序触发的 scrollY 变化）
    const expectedDiff = idealScrollY - window.scrollY;
    if (Math.abs(expectedDiff) > 50) {
      // 用户大幅滚动（手动翻页、锚点跳转等），重新同步
      idealScrollY = window.scrollY;
    }

    // 更新浮点理想位置
    if (direction === "down") {
      idealScrollY += delta;
    } else {
      idealScrollY -= delta;
    }

    // 边界钳位
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    idealScrollY = Math.max(0, Math.min(idealScrollY, maxScroll));

    // scrollTo 接受浮点值，浏览器内部处理亚像素渲染
    window.scrollTo(0, idealScrollY);

    // 到达页面边界自动停止
    const atBottom = direction === "down" && idealScrollY >= maxScroll - 1;
    const atTop = direction === "up" && idealScrollY <= 0;

    if (atBottom || atTop) {
      stopScroll();
      return;
    }

    animFrameId = requestAnimationFrame(scrollStep);
  }

  function startScroll() {
    if (isScrolling) return;
    isScrolling = true;
    idealScrollY = window.scrollY;  // 从当前位置开始
    lastFrameTime = 0;              // 首帧会初始化时间戳
    animFrameId = requestAnimationFrame(scrollStep);
    updateIndicator();
  }

  function stopScroll() {
    isScrolling = false;
    lastFrameTime = 0;
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
      textSpan.textContent = direction === "down" ? "向下滚动中 / Scrolling ↓" : "向上滚动中 / Scrolling ↑";
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

  // ─── 页面级键盘快捷键（Ctrl+Space 兜底） ──────────────────────
  document.addEventListener("keydown", (e) => {
    // 忽略输入框内的按键
    const tag = e.target.tagName;
    const isEditable = e.target.isContentEditable ||
      tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (isEditable) return;

    // Ctrl+Space: 开/关自动滚动
    if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.code === "Space" || e.key === " ")) {
      e.preventDefault();
      toggleScroll();
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
