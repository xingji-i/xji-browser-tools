/**
 * Doc Line Highlight - popup.js
 * Popup 控制面板逻辑
 */

const statusValue = document.getElementById("statusValue");
const currentText = document.getElementById("currentText");
const toggleBtn = document.getElementById("toggleBtn");
const gotoInput = document.getElementById("gotoInput");
const gotoBtn = document.getElementById("gotoBtn");
const bgColor = document.getElementById("bgColor");
const outlineColor = document.getElementById("outlineColor");

/* ─── 获取当前 tab 并查询状态 ─── */
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshStatus() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    statusValue.textContent = "不可用\nUnavailable";
    statusValue.classList.add("inactive");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "DLH_GET_STATUS" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      statusValue.textContent = "不可用\nUnavailable";
      statusValue.classList.add("inactive");
      currentText.textContent = "页面未加载插件脚本\nContent script not loaded";
      toggleBtn.textContent = "开启\nEnable";
      toggleBtn.className = "toggle-btn off";
      return;
    }

    if (response.active) {
      statusValue.textContent = `${response.currentIndex} / ${response.totalLines}`;
      statusValue.classList.remove("inactive");
      currentText.textContent = response.currentText || "(空行)\n(empty)";
      toggleBtn.textContent = "关闭\nDisable";
      toggleBtn.className = "toggle-btn on";
      gotoInput.max = response.totalLines;
    } else {
      statusValue.textContent = `- / ${response.totalLines || "-"}`;
      statusValue.classList.add("inactive");
      currentText.textContent = "按 Ctrl+Shift+L 开启\nPress Ctrl+Shift+L to start";
      toggleBtn.textContent = "开启\nEnable";
      toggleBtn.className = "toggle-btn off";
    }
  });
}

/* ─── 发送命令 ─── */
async function sendCommand(command) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(
    tab.id,
    { type: "DLH_COMMAND", command },
    () => {
      // 命令发送后延迟刷新状态
      setTimeout(refreshStatus, 100);
    }
  );
}

async function sendGotoLine(line) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(
    tab.id,
    { type: "DLH_GOTO_LINE", line },
    () => {
      setTimeout(refreshStatus, 100);
    }
  );
}

async function sendSettings(settings) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(
    tab.id,
    { type: "DLH_UPDATE_SETTINGS", settings }
  );
  // 持久化
  chrome.storage.local.set({ dlh_settings: settings });
}

/* ─── 事件绑定 ─── */
toggleBtn.addEventListener("click", () => {
  sendCommand("toggle-highlight");
});

gotoBtn.addEventListener("click", () => {
  const val = gotoInput.value.trim();
  if (val) sendGotoLine(val);
});

gotoInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const val = gotoInput.value.trim();
    if (val) sendGotoLine(val);
  }
});

/* ─── 颜色设置 ─── */
// 加载已保存的颜色
chrome.storage.local.get(["dlh_settings"], (result) => {
  const s = result.dlh_settings || {};
  if (s.highlightColor) bgColor.value = s.highlightColor;
  if (s.outlineColor) outlineColor.value = s.outlineColor;
});

bgColor.addEventListener("input", () => {
  sendSettings({ highlightColor: bgColor.value });
});

outlineColor.addEventListener("input", () => {
  sendSettings({ outlineColor: outlineColor.value });
});

/* ─── 定时刷新状态 ─── */
refreshStatus();
setInterval(refreshStatus, 1000);
