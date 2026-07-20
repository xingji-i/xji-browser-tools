/**
 * content.js — Auto Scroll core engine (Mobile/Safari adapted)
 * Injected into every page. Handles:
 *   1. requestAnimationFrame-based smooth scrolling (floating-point ideal position)
 *   2. Frame-rate independent speed (works on 60Hz/120Hz displays)
 *   3. Messages from popup to control scroll state
 *   4. Touch-friendly floating indicator (tap to start/stop)
 *   5. iOS dynamic viewport handling (address bar show/hide)
 */

(() => {
  "use strict";

  // Unified namespace: Safari uses `browser`, Chrome uses `chrome`
  const ext = typeof browser !== "undefined" ? browser : chrome;

  // ─── State ──────────────────────────────────────────────────
  let isScrolling = false;
  let speed = 0.4;         // px/frame (0.1~3.0), internally converted to px/s
  let direction = "down";  // "up" | "down"
  let smooth = true;
  let animFrameId = null;
  let idealScrollY = 0;    // floating-point ideal scroll position
  let lastFrameTime = 0;   // previous frame timestamp for frame-rate independence

  // ─── Floating Indicator (touch-friendly) ────────────────────
  const indicator = document.createElement("div");
  indicator.id = "auto-scroll-indicator";
  Object.assign(indicator.style, {
    position: "fixed",
    bottom: "24px",
    right: "16px",
    zIndex: "2147483647",
    display: "none",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    borderRadius: "24px",
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
    transition: "opacity 0.2s, transform 0.15s",
    opacity: "0.92"
  });

  // Touch feedback
  indicator.addEventListener("touchstart", () => {
    indicator.style.transform = "scale(0.95)";
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
  speedSpan.style.opacity = "0.5";
  speedSpan.style.fontSize = "12px";
  indicator.appendChild(speedSpan);

  document.documentElement.appendChild(indicator);

  // ─── Scroll Engine (floating-point + frame-rate independent) ─
  function scrollStep(timestamp) {
    if (!isScrolling) return;

    // Initialize timestamp on first frame
    if (!lastFrameTime) {
      lastFrameTime = timestamp;
      animFrameId = requestAnimationFrame(scrollStep);
      return;
    }

    // Frame interval in seconds, capped at 100ms to prevent jumps after tab switch
    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
    lastFrameTime = timestamp;

    // Frame-rate independent: speed(px/frame) × 60 = px/s, × dt = this frame's delta
    const delta = speed * 60 * dt;

    // Detect manual user scroll (swipe, address bar change, anchor jump)
    const drift = idealScrollY - window.scrollY;
    if (Math.abs(drift) > 80) {
      // User swiped significantly — re-sync
      idealScrollY = window.scrollY;
    }

    // Update floating-point ideal position
    if (direction === "down") {
      idealScrollY += delta;
    } else {
      idealScrollY -= delta;
    }

    // Boundary clamp
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    idealScrollY = Math.max(0, Math.min(idealScrollY, maxScroll));

    // scrollTo accepts float values; browser handles sub-pixel rendering
    window.scrollTo(0, idealScrollY);

    // Auto-stop at page boundaries
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

  // ─── Format speed for display ───────────────────────────────
  function formatSpeed(s) {
    if (s < 1) return s.toFixed(1);
    if (s === Math.floor(s)) return s.toString();
    return s.toFixed(1);
  }

  // ─── Indicator UI update ────────────────────────────────────
  function updateIndicator() {
    if (isScrolling) {
      indicator.style.display = "flex";
      arrowSpan.textContent = direction === "down" ? "↓" : "↑";
      textSpan.textContent = direction === "down" ? "Scrolling" : "Scrolling ↑";
      speedSpan.textContent = `×${formatSpeed(speed)}`;
    } else {
      indicator.style.display = "none";
    }
  }

  // ─── Message listener (from popup) ──────────────────────────
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

  // ─── Init: load settings from storage ───────────────────────
  ext.storage.local.get("scrollSettings", (result) => {
    const s = result.scrollSettings;
    if (s) {
      speed = s.speed ?? 0.4;
      direction = s.direction ?? "down";
      smooth = s.smooth ?? true;
    }
  });
})();
