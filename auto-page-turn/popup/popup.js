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

// ─── 状态缓存 ───────────────────────────────────────────────
let state = {
  isScrolling: false,
  speed: 0.4,       // 内部实际速度（px/帧）
  direction: "down",
  smooth: true
};

// ─── UI 更新 ────────────────────────────────────────────────
function updateUI() {
  // 主控按钮
  if (state.isScrolling) {
    btnToggle.classList.add("running");
    btnIcon.textContent = "⏸";
    btnLabel.textContent = "停止滚动";
    statusDot.classList.add("active");
    statusText.classList.add("active");
    statusText.textContent = state.direction === "down" ? "向下滚动中…" : "向上滚动中…";
  } else {
    btnToggle.classList.remove("running");
    btnIcon.textContent = "▶";
    btnLabel.textContent = "开始滚动";
    statusDot.classList.remove("active");
    statusText.classList.remove("active");
    statusText.textContent = "已停止";
  }

  // 方向按钮
  btnDown.classList.toggle("active", state.direction === "down");
  btnUp.classList.toggle("active", state.direction === "up");

  // 速度
  const sliderVal = speedToSlider(state.speed);
  speedSlider.value = sliderVal;
  speedValue.textContent = formatSpeed(state.speed);
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
  const result = await browser.storage.local.get("scrollSettings");
  if (result.scrollSettings) {
    state.speed = result.scrollSettings.speed ?? 0.4;
    state.direction = result.scrollSettings.direction ?? "down";
    state.smooth = result.scrollSettings.smooth ?? true;
  }

  // 再从 content script 获取实时状态
  const live = await sendToContent({ action: "getState" });
  if (live) {
    state.isScrolling = live.isScrolling;
    state.speed = live.speed;
    state.direction = live.direction;
    state.smooth = live.smooth;
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

// 页面关闭时同步设置
window.addEventListener("blur", saveSettings);

// ─── 启动 ───────────────────────────────────────────────────
initState();
