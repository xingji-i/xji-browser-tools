/**
 * popup.js — 弹出面板交互逻辑
 * 职责：
 *   1. 与 content script 通信获取/设置状态
 *   2. 更新 UI 反映当前滚动状态
 *   3. 持久化用户设置到 storage
 *
 * 速度映射：滑块 1~10 → 实际速度 0.1 ~ 3.0 px/帧
 *   1→0.1  2→0.2  3→0.4  4→0.6  5→0.8
 *   6→1.0  7→1.4  8→1.8  9→2.4  10→3.0
 */

const browser = typeof globalThis.browser !== "undefined" ? globalThis.browser : chrome;

// ─── 速度映射表 ─────────────────────────────────────────────
const SPEED_MAP = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0, 1.4, 1.8, 2.4, 3.0];

function sliderToSpeed(val) {
  return SPEED_MAP[Math.max(1, Math.min(10, Math.round(val)))];
}

function speedToSlider(speed) {
  // 反向查找最接近的滑块值
  let best = 3;
  let bestDiff = Infinity;
  for (let i = 1; i <= 10; i++) {
    const diff = Math.abs(SPEED_MAP[i] - speed);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

function formatSpeed(speed) {
  if (speed < 1) return speed.toFixed(1);
  if (speed === Math.floor(speed)) return speed.toString();
  return speed.toFixed(1);
}

// 找到当前速度最接近的档位下标（SPEED_MAP 从 1 开始）
function speedIndex(speed) {
  let best = 3;
  let bestDiff = Infinity;
  for (let i = 1; i <= 10; i++) {
    const diff = Math.abs(SPEED_MAP[i] - speed);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

// 按档位加减速：dir=+1 加速，dir=-1 减速
function stepSpeed(dir) {
  const idx = Math.max(1, Math.min(10, speedIndex(state.speed) + dir));
  state.speed = SPEED_MAP[idx];
  speedValue.textContent = formatSpeed(state.speed);
  miniSpeed.textContent = formatSpeed(state.speed);
  sendToContent({ action: "setSpeed", speed: state.speed });
  saveSettings();
}

// ─── DOM 元素 ───────────────────────────────────────────────
const btnToggle   = document.getElementById("btnToggle");
const btnIcon     = document.getElementById("btnIcon");
const btnLabel    = document.getElementById("btnLabel");
const btnDown     = document.getElementById("btnDown");
const btnUp       = document.getElementById("btnUp");
const speedSlider = document.getElementById("speedSlider");
const speedValue  = document.getElementById("speedValue");
const statusDot   = document.getElementById("statusDot");
const statusText  = document.getElementById("statusText");
const fullPanel    = document.getElementById("fullPanel");
const collapsedBar = document.getElementById("collapsedBar");
const btnCollapse  = document.getElementById("btnCollapse");
const btnExpand    = document.getElementById("btnExpand");
const btnMiniToggle = document.getElementById("btnMiniToggle");
const btnSlower    = document.getElementById("btnSlower");
const btnFaster    = document.getElementById("btnFaster");
const miniSpeed    = document.getElementById("miniSpeed");
const container    = document.querySelector(".container");
const btnTurnPage  = document.getElementById("btnTurnPage");
const btnAutoTurn  = document.getElementById("btnAutoTurn");
const nextLinkHint = document.getElementById("nextLinkHint");

// ─── 状态缓存 ───────────────────────────────────────────────
let state = {
  isScrolling: false,
  userPaused: false,  // 用户手动滚动时自动滚动暂时让位
  speed: 0.4,       // 内部实际速度（px/帧）
  direction: "down",
  smooth: true,
  collapsed: false, // 面板是否收起
  autoPageTurn: false, // 小说站自动翻页模式
  nextLinkFound: false // 当前页是否识别到"下一页"控件
};

// ─── UI 更新 ────────────────────────────────────────────────
function updateUI() {
  // 收起/展开切换
  container.classList.toggle("collapsed", state.collapsed);
  fullPanel.style.display = state.collapsed ? "none" : "flex";
  collapsedBar.style.display = state.collapsed ? "flex" : "none";

  // 主控按钮
  if (state.isScrolling) {
    btnToggle.classList.add("running");
    btnIcon.textContent = "⏸";
    btnLabel.textContent = "停止滚动\nStop Scrolling";
    statusDot.classList.add("active");
    statusText.classList.add("active");
    if (state.userPaused) {
      statusText.textContent = "手动滚动中，已暂停\nPaused for manual scrolling";
    } else {
      statusText.textContent = state.direction === "down" ? "向下滚动中…\nScrolling down…" : "向上滚动中…\nScrolling up…";
    }
    // 收起模式：暂停图标
    btnMiniToggle.classList.add("running");
    btnMiniToggle.textContent = "⏸";
  } else {
    btnToggle.classList.remove("running");
    btnIcon.textContent = "▶";
    btnLabel.textContent = "开始滚动\nStart Scrolling";
    statusDot.classList.remove("active");
    statusText.classList.remove("active");
    statusText.textContent = "已停止\nStopped";
    // 收起模式：播放图标
    btnMiniToggle.classList.remove("running");
    btnMiniToggle.textContent = "▶";
  }

  // 方向按钮
  btnDown.classList.toggle("active", state.direction === "down");
  btnUp.classList.toggle("active", state.direction === "up");

  // 速度
  const sliderVal = speedToSlider(state.speed);
  speedSlider.value = sliderVal;
  speedValue.textContent = formatSpeed(state.speed);
  miniSpeed.textContent = formatSpeed(state.speed);

  // 小说翻页
  btnAutoTurn.classList.toggle("active", state.autoPageTurn);
  nextLinkHint.classList.toggle("found", state.nextLinkFound);
  nextLinkHint.classList.toggle("miss", !state.nextLinkFound);
  nextLinkHint.textContent = state.nextLinkFound ? "已识别下一页" : "未检测到下一页";
}

// ─── 与 content script 通信 ─────────────────────────────────
async function sendToContent(msg) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    const response = await browser.tabs.sendMessage(tab.id, msg);
    return response;
  } catch (e) {
    console.warn("无法与页面通信:", e.message);
    return null;
  }
}

// ─── 初始化：获取当前状态 ────────────────────────────────────
async function initState() {
  // 先从 storage 加载
  const result = await browser.storage.local.get(["scrollSettings", "uiCollapsed"]);
  if (result.scrollSettings) {
    state.speed = result.scrollSettings.speed ?? 0.4;
    state.direction = result.scrollSettings.direction ?? "down";
    state.smooth = result.scrollSettings.smooth ?? true;
  }
  state.collapsed = result.uiCollapsed ?? false;

  // 再从 content script 获取实时状态
  const live = await sendToContent({ action: "getState" });
  if (live) {
    state.isScrolling = live.isScrolling;
    state.userPaused = !!live.userPaused;
    state.speed = live.speed;
    state.direction = live.direction;
    state.smooth = live.smooth;
    state.autoPageTurn = !!live.autoPageTurn;
    state.nextLinkFound = !!live.nextLinkFound;
  }

  updateUI();
}

// ─── 保存设置到 storage ─────────────────────────────────────
function saveSettings() {
  browser.storage.local.set({
    scrollSettings: {
      speed: state.speed,
      direction: state.direction,
      smooth: state.smooth
    }
  });
}

// ─── 事件绑定 ───────────────────────────────────────────────

// 开始/停止
btnToggle.addEventListener("click", async () => {
  const resp = await sendToContent({ action: "toggle" });
  if (resp) {
    state.isScrolling = resp.isScrolling;
  } else {
    state.isScrolling = !state.isScrolling;
  }
  updateUI();
});

// 方向切换
btnDown.addEventListener("click", () => setDirection("down"));
btnUp.addEventListener("click", () => setDirection("up"));

function setDirection(dir) {
  state.direction = dir;
  updateUI();
  sendToContent({ action: "setDirection", direction: dir });
  saveSettings();
}

// 速度调节
speedSlider.addEventListener("input", (e) => {
  const sliderVal = parseInt(e.target.value, 10);
  state.speed = sliderToSpeed(sliderVal);
  speedValue.textContent = formatSpeed(state.speed);
  sendToContent({ action: "setSpeed", speed: state.speed });
  saveSettings();
});

// 收起 / 展开（记住选择，下次打开保持一致）
function setCollapsed(collapsed) {
  state.collapsed = collapsed;
  updateUI();
  browser.storage.local.set({ uiCollapsed: collapsed });
}
btnCollapse.addEventListener("click", () => setCollapsed(true));
btnExpand.addEventListener("click", () => setCollapsed(false));

// 收起模式：播放/暂停
btnMiniToggle.addEventListener("click", async () => {
  const resp = await sendToContent({ action: "toggle" });
  if (resp) {
    state.isScrolling = resp.isScrolling;
  } else {
    state.isScrolling = !state.isScrolling;
  }
  updateUI();
});

// 收起模式：< > 加减速
btnSlower.addEventListener("click", () => stepSpeed(-1));
btnFaster.addEventListener("click", () => stepSpeed(1));

// 小说翻页：手动翻一页（快捷键 Ctrl+→ 同效）
btnTurnPage.addEventListener("click", async () => {
  const resp = await sendToContent({ action: "turnPage" });
  if (resp && resp.turned) {
    nextLinkHint.classList.remove("miss");
    nextLinkHint.classList.add("found");
    nextLinkHint.textContent = "翻页成功，加载中…";
    // 页面即将导航/跳转，短暂延迟后关闭弹窗
    setTimeout(() => window.close(), 400);
  } else {
    nextLinkHint.classList.remove("found");
    nextLinkHint.classList.add("miss");
    nextLinkHint.textContent = "未找到下一页按钮";
  }
});

// 小说翻页：自动翻页模式（滚到底自动点下一页，跨章节续读）
btnAutoTurn.addEventListener("click", async () => {
  const target = !state.autoPageTurn;
  const resp = await sendToContent({ action: "toggleAutoPageTurn", on: target });
  state.autoPageTurn = resp ? !!resp.autoPageTurn : target;
  if (state.autoPageTurn) state.isScrolling = true; // 开启时自动开始滚动
  updateUI();
});

// 页面关闭时同步设置
window.addEventListener("blur", saveSettings);

// ─── 启动 ───────────────────────────────────────────────────
initState();
