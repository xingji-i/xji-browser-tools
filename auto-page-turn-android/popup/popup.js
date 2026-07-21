/**
 * popup.js — Auto Scroll Android popup controller
 * Communicates with content script to get/set scroll state.
 */

const ext = typeof browser !== "undefined" ? browser : chrome;

// Speed mapping: slider 1~10 → actual speed 0.1 ~ 3.0 px/frame
const SPEED_MAP = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0, 1.4, 1.8, 2.4, 3.0];

function sliderToSpeed(val) {
  return SPEED_MAP[Math.max(1, Math.min(10, Math.round(val)))];
}

function speedToSlider(speed) {
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

// ─── DOM ──────────────────────────────────────────────────────
const btnToggle   = document.getElementById("btnToggle");
const btnIcon     = document.getElementById("btnIcon");
const btnLabel    = document.getElementById("btnLabel");
const btnDown     = document.getElementById("btnDown");
const btnUp       = document.getElementById("btnUp");
const speedSlider = document.getElementById("speedSlider");
const speedValue  = document.getElementById("speedValue");
const statusDot   = document.getElementById("statusDot");
const statusText  = document.getElementById("statusText");

// ─── State ────────────────────────────────────────────────────
let state = {
  isScrolling: false,
  speed: 0.4,
  direction: "down",
  smooth: true
};

// ─── UI update ────────────────────────────────────────────────
function updateUI() {
  if (state.isScrolling) {
    btnToggle.classList.add("running");
    btnIcon.textContent = "⏸";
    btnLabel.textContent = "Stop Scrolling";
    statusDot.classList.add("active");
    statusText.classList.add("active");
    statusText.textContent = state.direction === "down" ? "Scrolling down…" : "Scrolling up…";
  } else {
    btnToggle.classList.remove("running");
    btnIcon.textContent = "▶";
    btnLabel.textContent = "Start Scrolling";
    statusDot.classList.remove("active");
    statusText.classList.remove("active");
    statusText.textContent = "Stopped";
  }

  btnDown.classList.toggle("active", state.direction === "down");
  btnUp.classList.toggle("active", state.direction === "up");

  const sliderVal = speedToSlider(state.speed);
  speedSlider.value = sliderVal;
  speedValue.textContent = formatSpeed(state.speed);
}

// ─── Content script communication ─────────────────────────────
async function sendToContent(msg) {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    return await ext.tabs.sendMessage(tab.id, msg);
  } catch (e) {
    console.warn("Cannot communicate with page:", e.message);
    return null;
  }
}

// ─── Init ─────────────────────────────────────────────────────
async function initState() {
  const result = await ext.storage.local.get("scrollSettings");
  if (result.scrollSettings) {
    state.speed = result.scrollSettings.speed ?? 0.4;
    state.direction = result.scrollSettings.direction ?? "down";
    state.smooth = result.scrollSettings.smooth ?? true;
  }

  const live = await sendToContent({ action: "getState" });
  if (live) {
    state.isScrolling = live.isScrolling;
    state.speed = live.speed;
    state.direction = live.direction;
    state.smooth = live.smooth;
  }

  updateUI();
}

// ─── Save settings ────────────────────────────────────────────
function saveSettings() {
  ext.storage.local.set({
    scrollSettings: {
      speed: state.speed,
      direction: state.direction,
      smooth: state.smooth
    }
  });
}

// ─── Events ───────────────────────────────────────────────────

btnToggle.addEventListener("click", async () => {
  const resp = await sendToContent({ action: "toggle" });
  if (resp) {
    state.isScrolling = resp.isScrolling;
  } else {
    state.isScrolling = !state.isScrolling;
  }
  updateUI();
});

btnDown.addEventListener("click", () => setDirection("down"));
btnUp.addEventListener("click", () => setDirection("up"));

function setDirection(dir) {
  state.direction = dir;
  updateUI();
  sendToContent({ action: "setDirection", direction: dir });
  saveSettings();
}

speedSlider.addEventListener("input", (e) => {
  const sliderVal = parseInt(e.target.value, 10);
  state.speed = sliderToSpeed(sliderVal);
  speedValue.textContent = formatSpeed(state.speed);
  sendToContent({ action: "setSpeed", speed: state.speed });
  saveSettings();
});

window.addEventListener("blur", saveSettings);

initState();
