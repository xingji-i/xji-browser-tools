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
  nextLinkFound: false, // 当前页是否识别到"下一页"控件
  connected: false    // 是否成功与页面内脚本通信（未连接=脚本未注入）
};

// ─── 与页面实时同步（快捷键等非面板操作也能反映到 UI） ──────
// 页面内脚本在每次状态变化时都会广播 stateChanged，
// 面板收到后立刻刷新，因此用快捷键开始/暂停时按钮文案会同步变化。
let lastLiveAt = 0; // 最近一次收到页面状态回报的时刻（用于快捷键去重）

browser.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.action !== "stateChanged" || !msg.state) return;
  lastLiveAt = Date.now();
  applyLiveState(msg.state);
});

// 合并页面返回的实时状态并刷新 UI
function applyLiveState(live) {
  state.connected = true;
  state.isScrolling = !!live.isScrolling;
  state.userPaused = !!live.userPaused;
  if (typeof live.speed === "number") state.speed = live.speed;
  if (live.direction) state.direction = live.direction;
  if (typeof live.smooth === "boolean") state.smooth = live.smooth;
  state.autoPageTurn = !!live.autoPageTurn;
  if ("nextLinkFound" in live) state.nextLinkFound = !!live.nextLinkFound;
  updateUI();
}

// 主动拉取一次页面状态（广播偶发丢失时兜底）
async function refreshState() {
  const live = await sendToContent({ action: "getState" });
  if (live) {
    applyLiveState(live);
  } else if (state.connected) {
    state.connected = false;
    updateUI();
  }
}

// 定时轮询兜底：面板打开期间保持与页面状态一致（如页面自身边界停止滚动）
const POLL_INTERVAL = 800;
let pollTimer = null;
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(refreshState, POLL_INTERVAL);
  window.addEventListener("unload", () => { if (pollTimer) clearInterval(pollTimer); });
}

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
  if (!state.connected) {
    nextLinkHint.classList.add("miss");
    nextLinkHint.classList.remove("found");
    nextLinkHint.textContent = "扩展未连接，请刷新页面";
  } else {
    nextLinkHint.classList.toggle("found", state.nextLinkFound);
    nextLinkHint.classList.toggle("miss", !state.nextLinkFound);
    nextLinkHint.textContent = state.nextLinkFound ? "已识别下一页" : "未检测到下一页";
  }
}

// ─── 与 content script 通信 ─────────────────────────────────
let commWarned = false; // 轮询下避免刷屏，通信失败只提示一次

async function sendToContent(msg) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    const response = await browser.tabs.sendMessage(tab.id, msg);
    commWarned = false;
    return response;
  } catch (e) {
    if (!commWarned) {
      console.warn("无法与页面通信:", e.message);
      commWarned = true;
    }
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
  if (live) applyLiveState(live);
  state.connected = !!live;

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
  } else if (!resp) {
    nextLinkHint.classList.remove("found");
    nextLinkHint.classList.add("miss");
    nextLinkHint.textContent = "扩展未连接，请刷新页面";
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

// ─── 面板内快捷键 ───────────────────────────────────────────
// 面板获得焦点时，按键可能不再传到页面，这里自行转发并同步 UI。
// 去重策略：若页面刚回报过状态变化，说明浏览器快捷键命令已生效，直接跳过，
// 避免"命令 + 面板"各执行一次造成双重切换。
document.addEventListener("keydown", (e) => {
  if (!e.ctrlKey || e.altKey || e.metaKey) return;
  const handledByCommand = Date.now() - lastLiveAt < 250;

  // Ctrl+Space：开始 / 停止
  if (!e.shiftKey && (e.code === "Space" || e.key === " ")) {
    e.preventDefault();
    if (handledByCommand) return;
    toggleFromPopup();
    return;
  }

  // Ctrl+↑ / Ctrl+↓（以及命令用的 Ctrl+Shift+↑/↓）：加速 / 减速
  const isUp = e.code === "ArrowUp";
  const isDown = e.code === "ArrowDown";
  if (isUp || isDown) {
    // 滑块聚焦时交给滑块原生调整（其 input 事件已负责同步速度）
    if (e.target && e.target.type === "range") return;
    e.preventDefault();
    if (handledByCommand) return;
    stepSpeed(isUp ? 1 : -1);
  }
});

// 面板内触发开关：以页面返回的结果为准刷新 UI
async function toggleFromPopup() {
  const resp = await sendToContent({ action: "toggle" });
  if (resp) {
    state.isScrolling = !!resp.isScrolling;
    updateUI();
  } else {
    await refreshState();
  }
}

// 页面关闭时同步设置
window.addEventListener("blur", saveSettings);

// ─── 启动 ───────────────────────────────────────────────────
initState();
startPolling();
