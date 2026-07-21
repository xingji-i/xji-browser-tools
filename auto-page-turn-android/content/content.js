/**
 * content.js — Auto Scroll core engine (Android/Mobile adapted)
 * Injected into every page. Handles:
 *   1. requestAnimationFrame smooth scrolling (floating-point ideal position)
 *   2. Frame-rate independent speed (60Hz/120Hz consistent)
 *   3. Messages from popup to control scroll state
 *   4. Touch-friendly floating indicator (tap to start/stop)
 *   5. Android dynamic viewport handling (URL bar show/hide)
 */

(() => {
  "use strict";

  // Unified namespace: Kiwi/Yandex use chrome, Firefox uses browser
  const ext = typeof browser !== "undefined" ? browser : chrome;

  // ─── State ──────────────────────────────────────────────────
  let isScrolling = false;
  let speed = 0.4;
  let direction = "down";
  let smooth = true;
  let animFrameId = null;
  let idealScrollY = 0;
  let lastFrameTime = 0;

  // ─── Floating Indicator (touch-friendly, Android optimized) ──
  const indicator = document.createElement("div");
  indicator.id = "auto-scroll-indicator";
  Object.assign(indicator.style, {
    position: "fixed",
    bottom: "80px",          // higher to avoid Android nav bar
    right: "12px",
    zIndex: "2147483647",
    display: "none",
    alignItems: "center",
    gap: "8px",
    padding: "12px 18px",
    borderRadius: "28px",
    background: "rgba(255,255,255,0.94)",
    color: "#555",
    fontSize: "14px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
    cursor: "pointer",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
    transition: "opacity 0.2s, transform 0.12s",
    opacity: "0.92"
  });

  // Touch press feedback
  indicator.addEventListener("touchstart", () => {
    indicator.style.transform = "scale(0.93)";
    indicator.style.opacity = "1";
  }, { passive: true });
  indicator.addEventListener("touchend", () => {
    indicator.style.transform = "scale(1)";
    indicator.style.opacity = "0.92";
  }, { passive: true });
  indicator.addEventListener("click", () => toggleScroll());

  const arrowSpan = document.createElement("span");
  arrowSpan.style.fontSize = "16px";
  arrowSpan.style.lineHeight = "1";
  arrowSpan.style.color = "#8a7e6b";
  indicator.appendChild(arrowSpan);

  const textSpan = document.createElement("span");
  textSpan.style.color = "#666";
  textSpan.style.fontSize = "13px";
  indicator.appendChild(textSpan);

  const speedSpan = document.createElement("span");
  speedSpan.style.opacity = "0.55";
  speedSpan.style.fontSize = "12px";
  indicator.appendChild(speedSpan);

  document.documentElement.appendChild(indicator);

  // ─── Scroll Engine ──────────────────────────────────────────
  function scrollStep(timestamp) {
    if (!isScrolling) return;

    if (!lastFrameTime) {
      lastFrameTime = timestamp;
      animFrameId = requestAnimationFrame(scrollStep);
      return;
    }

    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
    lastFrameTime = timestamp;

    // Frame-rate independent: speed(px/frame) × 60 = px/s × dt
    const delta = speed * 60 * dt;

    // Detect manual user scroll (Android swipe gesture)
    const drift = idealScrollY - window.scrollY;
    if (Math.abs(drift) > 100) {
      idealScrollY = window.scrollY;
    }

    if (direction === "down") {
      idealScrollY += delta;
    } else {
      idealScrollY -= delta;
    }

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    idealScrollY = Math.max(0, Math.min(idealScrollY, maxScroll));

    window.scrollTo(0, idealScrollY);

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
    idealScrollY = window.scrollY;
    lastFrameTime = 0;
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

  // ─── Format speed ───────────────────────────────────────────
  function formatSpeed(s) {
    if (s < 1) return s.toFixed(1);
    if (s === Math.floor(s)) return s.toString();
    return s.toFixed(1);
  }

  // ─── Indicator UI ───────────────────────────────────────────
  function updateIndicator() {
    if (isScrolling) {
      indicator.style.display = "flex";
      arrowSpan.textContent = direction === "down" ? "↓" : "↑";
      textSpan.textContent = direction === "down" ? "滚动中" : "向上滚动";
      speedSpan.textContent = `×${formatSpeed(speed)}`;
    } else {
      indicator.style.display = "none";
    }
  }

  // ─── Message listener ───────────────────────────────────────
  ext.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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
      case "setSpeed":
        speed = Math.max(0.1, Math.min(3.0, Number(msg.speed) || 0.4));
        updateIndicator();
        break;
      case "setDirection":
        direction = msg.direction === "up" ? "up" : "down";
        updateIndicator();
        break;
      case "getState":
        sendResponse({ isScrolling, speed, direction, smooth });
        return true;
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

  // ─── Init: load settings ────────────────────────────────────
  ext.storage.local.get("scrollSettings", (result) => {
    const s = result.scrollSettings;
    if (s) {
      speed = s.speed ?? 0.4;
      direction = s.direction ?? "down";
      smooth = s.smooth ?? true;
    }
  });
})();
