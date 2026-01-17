// monkmode.js (LOCAL ONLY) — LocalStorage streak + script, once-per-day check-in

console.log("monkmode.js loaded (local)");

// ===============================
// UI ELEMENTS
// ===============================
const monkInput = document.getElementById("monkInput");
const streakDayText = document.getElementById("streakDayText");
const savedScriptText = document.getElementById("savedScriptText");
const lastCheckInText = document.getElementById("lastCheckInText");
const messageEl = document.getElementById("message");

const checkInBtn = document.getElementById("checkInBtn");
const saveScriptBtn = document.getElementById("saveScriptBtn");
const resetStreakBtn = document.getElementById("resetStreakBtn");

// ===============================
// CONSTANTS / LIMITS
// ===============================
const MAX_SCRIPT_LEN = 5000;
const RATE_LIMIT_MS = 900;
const LS_KEY = "disciplineos_monk_mode_v1";

// ===============================
// STATE
// ===============================
let isProcessing = false;
let lastActionAt = 0;

// ===============================
// MESSAGE
// ===============================
function showMessage(text, type = "success") {
  if (!messageEl) return;
  messageEl.textContent = String(text || "");
  messageEl.classList.remove("is-hidden", "success", "error");
  messageEl.classList.add(type === "error" ? "error" : "success");

  window.clearTimeout(showMessage._t);
  showMessage._t = window.setTimeout(() => {
    messageEl.classList.add("is-hidden");
  }, 5000);
}
function clearMessage() {
  if (!messageEl) return;
  messageEl.textContent = "";
  messageEl.classList.add("is-hidden");
  messageEl.classList.remove("success", "error");
}
function setButtonsDisabled(disabled) {
  const ds = !!disabled;
  checkInBtn && (checkInBtn.disabled = ds);
  saveScriptBtn && (saveScriptBtn.disabled = ds);
  resetStreakBtn && (resetStreakBtn.disabled = ds);
  monkInput && (monkInput.disabled = ds);
}

// Prevent placeholder flash
function revealLoadedUI() {
  savedScriptText?.classList.remove("is-loading");
  streakDayText?.classList.remove("is-loading");
  lastCheckInText?.classList.remove("is-loading");
}

// ===============================
// VALIDATION / NORMALIZATION
// ===============================
function normalize(s) {
  return String(s ?? "")
    .replace(/\r\n/g, "\n")
    .normalize("NFKC")
    .trimEnd();
}

function sanitizeForStorage(s, maxLen) {
  let out = normalize(s);
  out = out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  out = out.replace(/[\u200B-\u200F\uFEFF]/g, "");
  if (out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

// ===============================
// DATE/TIME
// ===============================
function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function getTimeString() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
function getPrettyDate(dateKey) {
  if (!dateKey) return "—";
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
function formatTimeAmPm(timeStr) {
  if (!timeStr) return "—";
  const parts = String(timeStr).split(":");
  const hh = parseInt(parts[0], 10);
  const mm = parts[1] ?? "00";
  const ss = parts[2];
  if (Number.isNaN(hh)) return String(timeStr);
  const ampm = hh >= 12 ? "PM" : "AM";
  const hour12 = ((hh + 11) % 12) + 1;
  return ss ? `${hour12}:${mm}:${ss} ${ampm}` : `${hour12}:${mm} ${ampm}`;
}

// ===============================
// STORAGE
// ===============================
function defaultState() {
  return {
    protocol_rules: "",
    current_streak: 0,
    last_checkin_date: null,
    last_checkin_time: null,
  };
}
function loadLocalState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}
function saveLocalState(next) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

// ===============================
// RENDER
// ===============================
function render(state) {
  const scriptRaw = String(state.protocol_rules ?? "");
  const script = scriptRaw.trim()
    ? scriptRaw
    : "No Monk Mode script saved yet. Your first check-in will lock it in.";
  if (savedScriptText) savedScriptText.textContent = script;

  const cur = Number(state.current_streak || 0);
  if (streakDayText) streakDayText.textContent = `Day ${cur}`;

  if (lastCheckInText) {
    if (state.last_checkin_date) {
      const pretty = getPrettyDate(state.last_checkin_date);
      const timePretty = state.last_checkin_time ? formatTimeAmPm(state.last_checkin_time) : "--:--";
      lastCheckInText.textContent = `Last Check-In: ${pretty} · ${timePretty}`;
    } else {
      lastCheckInText.textContent = "Last Check-In: —";
    }
  }

  revealLoadedUI();
}

// ===============================
// SINGLE-FLIGHT
// ===============================
async function guarded(actionName, fn) {
  const now = Date.now();
  if (now - lastActionAt < RATE_LIMIT_MS) {
    showMessage("Slow down — one action at a time.", "error");
    return;
  }
  lastActionAt = now;

  if (isProcessing) {
    showMessage("Please wait — finishing the previous action.", "error");
    return;
  }

  isProcessing = true;
  clearMessage();
  setButtonsDisabled(true);

  try {
    await fn();
  } catch (err) {
    console.warn(`${actionName} failed.`, err);
    showMessage("Operation failed. Please try again.", "error");
  } finally {
    isProcessing = false;
    setButtonsDisabled(false);
  }
}

// ===============================
// ACTIONS
// ===============================
saveScriptBtn?.addEventListener("click", () =>
  guarded("saveScript", async () => {
    const state = loadLocalState();

    const script = sanitizeForStorage(monkInput?.value ?? "", MAX_SCRIPT_LEN);
    if (!script.trim()) {
      showMessage("Type your Monk Mode script before saving.", "error");
      return;
    }

    const next = { ...state, protocol_rules: script };
    if (!saveLocalState(next)) {
      showMessage("Could not save. Your browser may be blocking localStorage.", "error");
      return;
    }

    render(next);
    if (!String(state.protocol_rules || "").trim()) {
      showMessage('Script saved. Now retype it exactly and press "Check In" to start Day 1.', "success");
    } else {
      showMessage("Script updated. Your streak stays the same — next check-in must match this script.", "success");
    }
  })
);

checkInBtn?.addEventListener("click", () =>
  guarded("checkIn", async () => {
    const state = loadLocalState();

    const input = sanitizeForStorage(monkInput?.value ?? "", MAX_SCRIPT_LEN);
    if (!input.trim()) {
      showMessage("Type your full Monk Mode script before checking in.", "error");
      return;
    }

    const todayKey = getTodayKey();
    const nowTime = getTimeString();

    // First check-in locks script + starts Day 1
    if (!String(state.protocol_rules || "").trim()) {
      const next = {
        ...state,
        protocol_rules: input,
        current_streak: 1,
        last_checkin_date: todayKey,
        last_checkin_time: nowTime,
      };

      if (!saveLocalState(next)) {
        showMessage("Could not save. Your browser may be blocking localStorage.", "error");
        return;
      }

      render(next);
      showMessage("Monk Mode script locked in. Day 1 has started.", "success");
      return;
    }

    // Already checked in today -> update time only
    if (state.last_checkin_date === todayKey) {
      const next = { ...state, last_checkin_time: nowTime };
      if (!saveLocalState(next)) {
        showMessage("Could not save. Your browser may be blocking localStorage.", "error");
        return;
      }
      render(next);
      showMessage("You already checked in today. Streak stays the same, time updated.", "success");
      return;
    }

    // Must match script exactly (normalized)
    if (normalize(input) !== normalize(state.protocol_rules)) {
      showMessage('This doesn’t match your saved Monk Mode script exactly. Use "Save / Update Script" if you changed it.', "error");
      return;
    }

    const nextStreak = Number(state.current_streak || 0) + 1;
    const next = {
      ...state,
      current_streak: nextStreak,
      last_checkin_date: todayKey,
      last_checkin_time: nowTime,
    };

    if (!saveLocalState(next)) {
      showMessage("Could not save. Your browser may be blocking localStorage.", "error");
      return;
    }

    render(next);
    showMessage(`Check-in logged. You are now on Monk Mode Day ${nextStreak}.`, "success");
  })
);

resetStreakBtn?.addEventListener("click", () =>
  guarded("resetStreak", async () => {
    const state = loadLocalState();
    const ok = confirm("Reset your Monk Mode streak back to Day 0? This keeps your script saved.");
    if (!ok) return;

    const next = {
      ...state,
      current_streak: 0,
      last_checkin_date: null,
      last_checkin_time: null,
    };

    if (!saveLocalState(next)) {
      showMessage("Could not save. Your browser may be blocking localStorage.", "error");
      return;
    }

    render(next);
    showMessage("Monk Mode streak reset to Day 0. Script still saved. Rebuild from zero.", "success");
  })
);

// ===============================
// INIT
// ===============================
function init() {
  setButtonsDisabled(false);
  clearMessage();

  const state = loadLocalState();
  render(state);
}
init();

// Auto-resize on focus (kept, but safe)
monkInput?.addEventListener("focus", () => {
  monkInput.style.height = "auto";
  monkInput.style.height = monkInput.scrollHeight + "px";
});
