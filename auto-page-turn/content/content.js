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

  // ─── 用户交互让位（手动滚动优先） ──────────────────────────
  let userPaused = false;    // 用户正在手动滚动，自动滚动暂时让位
  let resumeTimer = null;    // 恢复倒计时定时器
  let resumeAt = 0;          // 计划恢复的时刻（毫秒时间戳）
  let lastCountdown = -1;    // 上次显示的倒计时秒数
  let rampStart = 0;         // 恢复后速度爬坡的起始时间戳
  const RESUME_DELAY = 500; // 停止交互后多少毫秒恢复自动滚动
  const RAMP_DURATION = 500; // 恢复后速度从 0 爬升到全速的时长

  // ─── 自动翻页（小说站点击式翻页） ──────────────────────────
  let autoPageTurn = false; // 自动翻页模式：滚到底后自动点击"下一页"
  let pageTurnAt = 0;       // 计划执行翻页的时刻（毫秒时间戳），0 = 未计时
  const PAGE_TURN_DELAY = 2000; // 滚到底后等待多少毫秒再翻页
  const SESSION_KEY = "autoPageTurn.active"; // sessionStorage 键，跨页面续读

  // 速度档位（与 popup.js 的 SPEED_MAP 保持一致）
  const SPEED_STEPS = [0.1, 0.2, 0.4, 0.6, 0.8, 1.0, 1.4, 1.8, 2.4, 3.0];

  // 按档位加减速：dir=+1 加速，dir=-1 减速
  function stepSpeed(dir) {
    // 找到当前速度最接近的档位
    let idx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < SPEED_STEPS.length; i++) {
      const diff = Math.abs(SPEED_STEPS[i] - speed);
      if (diff < bestDiff) { bestDiff = diff; idx = i; }
    }
    idx = Math.max(0, Math.min(SPEED_STEPS.length - 1, idx + dir));
    speed = SPEED_STEPS[idx];
    updateIndicator();
    browser.storage.local.set({ scrollSettings: { speed, direction, smooth } });
  }

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

    // 用户手动滚动期间完全让位：不执行任何 scrollTo，
    // 只跟随用户位置并在指示器上显示恢复倒计时
    if (userPaused) {
      idealScrollY = window.scrollY;
      const remain = Math.max(0, Math.ceil((resumeAt - Date.now()) / 1000));
      if (remain !== lastCountdown) {
        lastCountdown = remain;
        textSpan.textContent = remain > 0
          ? `手动滚动已暂停 · ${remain}s 后恢复`
          : "手动滚动已暂停";
      }
      animFrameId = requestAnimationFrame(scrollStep);
      return;
    }

    // 首帧初始化时间戳
    if (!lastFrameTime) {
      lastFrameTime = timestamp;
      animFrameId = requestAnimationFrame(scrollStep);
      return;
    }

    // 计算帧间隔（秒），上限 100ms 防止切标签页后大跳
    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
    lastFrameTime = timestamp;

    // 恢复后前 RAMP_DURATION 内速度从 0 平滑爬升到全速，避免突然弹走
    let rampFactor = 1;
    if (rampStart) {
      const elapsed = timestamp - rampStart;
      if (elapsed < RAMP_DURATION) {
        rampFactor = Math.max(0.05, elapsed / RAMP_DURATION);
      } else {
        rampStart = 0; // 爬坡结束
      }
    }

    // 帧率无关：speed(px/frame) × 60 = px/s，再乘以 dt 得到本帧位移
    const delta = speed * 60 * dt * rampFactor;

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

    // 到达页面边界
    const atBottom = direction === "down" && idealScrollY >= maxScroll - 1;
    const atTop = direction === "up" && idealScrollY <= 0;

    // 自动翻页：滚到底后倒计时，到点自动点击"下一页"
    if (atBottom && autoPageTurn) {
      if (!pageTurnAt) {
        pageTurnAt = Date.now() + PAGE_TURN_DELAY;
      } else if (Date.now() >= pageTurnAt) {
        const turned = doTurnPage(false);
        if (isScrolling && turned) {
          // SPA 站点未发生导航时，从新页顶部继续滚动
          animFrameId = requestAnimationFrame(scrollStep);
        }
        return;
      }
      // 显示翻页倒计时
      const remain = Math.max(0, Math.ceil((pageTurnAt - Date.now()) / 1000));
      if (remain !== lastCountdown) {
        lastCountdown = remain;
        arrowSpan.textContent = "⏭";
        textSpan.textContent = remain > 0
          ? `已到底 · ${remain}s 后自动翻页`
          : "正在翻页…";
      }
      animFrameId = requestAnimationFrame(scrollStep);
      return;
    }

    if (atBottom || atTop) {
      stopScroll();
      return;
    }

    animFrameId = requestAnimationFrame(scrollStep);
  }

  function startScroll() {
    if (isScrolling) return;
    isScrolling = true;
    userPaused = false;
    rampStart = 0;
    idealScrollY = window.scrollY;  // 从当前位置开始
    lastFrameTime = 0;              // 首帧会初始化时间戳
    animFrameId = requestAnimationFrame(scrollStep);
    updateIndicator();
  }

  function stopScroll() {
    isScrolling = false;
    userPaused = false;
    pageTurnAt = 0;
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
    lastFrameTime = 0;
    rampStart = 0;
    // 手动停止 = 完全停止，同时结束自动翻页续读
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    updateIndicator();
  }

  // ─── 用户交互让位：检测到手动滚动时暂停，停手后自动恢复 ───
  function scheduleResume() {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeAt = Date.now() + RESUME_DELAY;
    lastCountdown = -1;
    resumeTimer = setTimeout(() => {
      resumeTimer = null;
      userPaused = false;
      if (isScrolling) {
        // 从用户当前停留的位置无缝接续，并做速度爬坡
        idealScrollY = window.scrollY;
        lastFrameTime = 0;
        rampStart = performance.now();
        updateIndicator();
      }
    }, RESUME_DELAY);
  }

  function pauseForUser() {
    if (!isScrolling) return;
    if (!userPaused) {
      userPaused = true;
      updateIndicator();
    }
    // 用户交互会顺延翻页倒计时（重新计时更符合直觉）
    pageTurnAt = 0;
    // 交互持续期间不断刷新倒计时
    scheduleResume();
  }

  // ─── 用户滚动意图检测（滚轮 / 触摸 / 拖拽滚动条 / 翻页键） ──
  // 全部使用 capture + passive：不拦截、不阻塞用户操作
  window.addEventListener("wheel", pauseForUser, { capture: true, passive: true });
  window.addEventListener("touchstart", pauseForUser, { capture: true, passive: true });
  window.addEventListener("touchmove", pauseForUser, { capture: true, passive: true });
  window.addEventListener("mousedown", (e) => {
    // 点在视口右/下边缘 16px 内视为拖拽滚动条
    const onVBar = e.clientX >= document.documentElement.clientWidth - 16;
    const onHBar = e.clientY >= document.documentElement.clientHeight - 16;
    if (onVBar || onHBar) pauseForUser();
  }, { capture: true, passive: true });
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const scrollKeys = ["PageUp", "PageDown", "Home", "End", "Space", "ArrowUp", "ArrowDown"];
    if (!scrollKeys.includes(e.code)) return;
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;
    pauseForUser();
  }, { capture: true, passive: true });

  function toggleScroll() {
    isScrolling ? stopScroll() : startScroll();
  }

  // ─── 下一页链接智能识别（启发式评分） ──────────────────────
  // 适用小说/漫画/长文分页站：识别"下一页/下一章/next/»"等控件
  const NEXT_TEXT_RE = /(下一页|下页|下一章|下章|下一节|后一页|next\s*page|^next$|^»$|^›$|»»|>>|❯)/i;
  const PREV_TEXT_RE = /(上一页|上页|上一章|上章|上一节|前一页|prev|previous|<<|«|‹|返回|目录|首页|末页|尾页)/i;
  const NEXT_ATTR_RE = /(^|[-_\d])(next|nextpage|pb_next|btnnext|linknext|gnext)([-_]|$)/i;
  const PREV_ATTR_RE = /(^|[-_\d])(prev|previous|pb_prev|btnprev|linkprev|gprev)([-_]|$)/i;

  function findNextLink() {
    let best = null;
    let bestScore = 0;

    const candidates = document.querySelectorAll(
      'a[rel="next"], a, button, [role="button"], [onclick], input[type="button"], input[type="submit"]'
    );

    for (const el of candidates) {
      const text = (el.textContent || el.value || "").trim();
      const aria = el.getAttribute("aria-label") || "";
      const title = el.getAttribute("title") || "";
      const attrs = `${el.id || ""} ${typeof el.className === "string" ? el.className : ""} ${el.getAttribute("name") || ""}`;

      // 排除"上一页"等反向控件
      if (PREV_TEXT_RE.test(text) || PREV_TEXT_RE.test(aria) || PREV_TEXT_RE.test(title) || PREV_ATTR_RE.test(attrs)) {
        continue;
      }
      // 文本过长的链接通常是正文/目录，不是翻页按钮（除非属性强匹配）
      const textMatch = NEXT_TEXT_RE.test(text) || NEXT_TEXT_RE.test(aria) || NEXT_TEXT_RE.test(title);
      const attrMatch = NEXT_ATTR_RE.test(attrs);
      if (text.length > 30 && !attrMatch && !aria) continue;

      let score = 0;
      if (el.matches && el.matches('a[rel="next"]')) {
        score = 100; // 语义标记，最高优先
      } else if (textMatch) {
        score = 90;
      } else if (attrMatch) {
        score = 60;
      }
      if (!score) continue;

      // href 指向当前页面的链接降权（可能是占位/禁用态）
      if (el.tagName === "A" && el.getAttribute("href")) {
        try {
          if (el.href === location.href) score -= 40;
        } catch (e) { /* ignore */ }
      }

      // 可见性：不可见的降权；位于页面下半部（翻页控件常见位置）加分
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) score -= 30;
      if (rect.top > window.innerHeight * 0.5) score += 10;

      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }

    return bestScore >= 30 ? best : null;
  }

  // ─── 执行翻页：点击下一页控件 ──────────────────────────────
  function doTurnPage(manual) {
    const link = findNextLink();
    if (!link) {
      if (manual) return false;
      // 自动模式找不到下一页：停止一切并提示
      setAutoPageTurn(false);
      stopScroll();
      indicator.style.display = "flex";
      arrowSpan.textContent = "✋";
      textSpan.textContent = "未找到下一页链接，已停止";
      setTimeout(() => { if (!isScrolling) updateIndicator(); }, 3000);
      return false;
    }

    // 自动模式记录续读意图：新页面加载后自动恢复滚动+翻页
    if (autoPageTurn) {
      try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) { /* 沙箱页面忽略 */ }
    }

    link.click();

    // SPA 站点可能不发生导航：回到顶部继续；真导航则本脚本随之销毁，无副作用
    pageTurnAt = 0;
    if (isScrolling) {
      idealScrollY = 0;
      lastFrameTime = 0;
      window.scrollTo(0, 0);
    }
    return true;
  }

  // ─── 自动翻页模式开关 ──────────────────────────────────────
  function setAutoPageTurn(on) {
    autoPageTurn = !!on;
    pageTurnAt = 0;
    try {
      if (autoPageTurn) sessionStorage.setItem(SESSION_KEY, "1");
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) { /* 沙箱页面忽略 */ }
    updateIndicator();
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
      if (userPaused) {
        arrowSpan.textContent = "⏸";
        textSpan.textContent = "手动滚动已暂停";
      } else {
        arrowSpan.textContent = direction === "down" ? "↓" : "↑";
        textSpan.textContent = direction === "down" ? "向下滚动中 / Scrolling ↓" : "向上滚动中 / Scrolling ↑";
      }
      speedSpan.textContent = autoPageTurn
        ? `×${formatSpeed(speed)} · ⏭自动翻页`
        : `×${formatSpeed(speed)}`;
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
      case "speedUp":
        stepSpeed(1);
        break;
      case "speedDown":
        stepSpeed(-1);
        break;
      case "setDirection":
        direction = msg.direction === "up" ? "up" : "down";
        updateIndicator();
        break;
      case "turnPage": {
        const turned = doTurnPage(true);
        sendResponse({ turned, autoPageTurn, isScrolling });
        return false;
      }
      case "toggleAutoPageTurn": {
        const on = msg.on ?? !autoPageTurn;
        setAutoPageTurn(on);
        // 开启自动翻页时如果没在滚动，自动开始滚动
        if (on && !isScrolling) startScroll();
        break;
      }
      case "getState":
        sendResponse({
          isScrolling,
          userPaused,
          speed,
          direction,
          smooth,
          autoPageTurn,
          nextLinkFound: !!findNextLink()
        });
        return true; // 异步响应
      case "applySettings":
        speed = msg.speed ?? speed;
        direction = msg.direction ?? direction;
        smooth = msg.smooth ?? smooth;
        updateIndicator();
        break;
    }
    sendResponse({ isScrolling, speed, direction, smooth, autoPageTurn });
    return false;
  });

  // ─── 页面级键盘快捷键（commands API 的兜底） ─────────────────
  // Ctrl+Space: 开/关；Ctrl+↑: 加速；Ctrl+↓: 减速
  // （浏览器 commands 使用 Ctrl+Shift+↑/↓，此处用不带 Shift 的组合避免重复触发）
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
      return;
    }

    // Ctrl+→: 翻到下一页（commands API 已注册同名命令，此处为兜底）
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === "ArrowRight") {
      e.preventDefault();
      doTurnPage(true);
      return;
    }

    // Ctrl+↑ / Ctrl+↓: 加速 / 减速
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === "ArrowUp") {
      e.preventDefault();
      stepSpeed(1);
    } else if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === "ArrowDown") {
      e.preventDefault();
      stepSpeed(-1);
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

  // ─── 初始化：自动翻页跨页面续读 ────────────────────────────
  // 翻页后 content script 会随旧页面销毁，sessionStorage 在同标签页/同源导航后
  // 仍然保留，新页面据此自动恢复"滚动 + 自动翻页"
  try {
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      autoPageTurn = true;
      startScroll();
    }
  } catch (e) { /* 沙箱页面忽略 */ }
})();
