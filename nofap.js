// nofap.js (LOCAL ONLY) — LocalStorage streak + identity, once-per-day check-in

console.log("nofap.js loaded (local)");

// ===============================
// UI ELEMENTS
// ===============================
const identityInput = document.getElementById("identityInput");
const streakDayText = document.getElementById("streakDayText");
const savedIdentityText = document.getElementById("savedIdentityText");
const lastCheckInText = document.getElementById("lastCheckInText");
const messageEl = document.getElementById("message");

const checkInBtn = document.getElementById("checkInBtn");
const saveIdentityBtn = document.getElementById("saveIdentityBtn");
const resetStreakBtn = document.getElementById("resetStreakBtn");

const startingDayInput = document.getElementById("startingDayInput");
const setStartingDayBtn = document.getElementById("setStartingDayBtn");

const charCountEl = document.getElementById("charCount");
const btnClearLocal = document.getElementById("btnClearLocal");

// Year
const yearNowEl = document.getElementById("yearNow");
try {
  if (yearNowEl) yearNowEl.textContent = String(new Date().getFullYear());
} catch {}

// ===============================
// CONSTANTS / LIMITS
// ===============================
const MAX_IDENTITY_LEN = 2000;
const MAX_STARTING_DAY = 5000;
const RATE_LIMIT_MS = 900;

// Storage keys
const LS_KEY = "disciplineos_nofap_nocorn_v1";

// ===============================
// STATE
// ===============================
let isProcessing = false;
let lastActionAt = 0;

// ===============================
// VISIBILITY
// ===============================
function revealLoadedUI() {
  savedIdentityText?.classList.remove("is-loading");
  streakDayText?.classList.remove("is-loading");
  lastCheckInText?.classList.remove("is-loading");
}

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
  if (checkInBtn) checkInBtn.disabled = ds;
  if (saveIdentityBtn) saveIdentityBtn.disabled = ds;
  if (resetStreakBtn) resetStreakBtn.disabled = ds;
  if (setStartingDayBtn) setStartingDayBtn.disabled = ds;
  if (identityInput) identityInput.disabled = ds;
  if (startingDayInput) startingDayInput.disabled = ds;
  if (btnClearLocal) btnClearLocal.disabled = ds;
}

function updateCharCount() {
  if (!charCountEl || !identityInput) return;
  charCountEl.textContent = `${identityInput.value.length}/${MAX_IDENTITY_LEN}`;
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

function sanitizeForStorage(s) {
  let out = normalize(s);
  out = out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  out = out.replace(/[\u200B-\u200F\uFEFF]/g, "");
  if (out.length > MAX_IDENTITY_LEN) out = out.slice(0, MAX_IDENTITY_LEN);
  return out;
}

// ===============================
// DATE/TIME (client-side + AM/PM helper)
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
    identity_statement: "",
    current_streak: 0,
    starting_day: 0,
    last_checkin_date: null,
    last_checkin_time: null,
  };
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultState(),
      ...parsed,
    };
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
  const stmtRaw = String(state.identity_statement ?? "");
  const stmt = stmtRaw.trim()
    ? stmtRaw
    : "No identity saved yet. Your first check-in will lock it in.";

  if (savedIdentityText) savedIdentityText.textContent = stmt;

  const base = Number(state.starting_day || 0);
  const cur = Number(state.current_streak || 0);
  if (streakDayText) streakDayText.textContent = `Day ${base + cur}`;

  if (lastCheckInText) {
    if (state.last_checkin_date) {
      const pretty = getPrettyDate(state.last_checkin_date);
      const timePretty = state.last_checkin_time ? formatTimeAmPm(state.last_checkin_time) : "--:--";
      lastCheckInText.textContent = `Last Check-In: ${pretty} · ${timePretty}`;
    } else {
      lastCheckInText.textContent = "Last Check-In: —";
    }
  }

  if (startingDayInput) startingDayInput.value = base ? String(base) : "";

  revealLoadedUI();
}

// ===============================
// SINGLE-FLIGHT + SOFT RATE LIMIT
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
    const msg =
      err?.message === "IDENTITY_MISMATCH"
        ? 'This doesn’t match your saved identity statement exactly. Use "Save / Update Identity" if you evolved it.'
        : "Operation failed. Please try again.";

    console.warn(`${actionName} failed.`, err);
    showMessage(msg, "error");
  } finally {
    isProcessing = false;
    setButtonsDisabled(false);
  }
}

// ===============================
// SET STARTING DAY
// ===============================
setStartingDayBtn?.addEventListener("click", () =>
  guarded("setStartingDay", async () => {
    const state = loadLocalState();

    const raw = String(startingDayInput?.value ?? "").trim();
    const desiredTotal = parseInt(raw, 10);

    if (Number.isNaN(desiredTotal) || desiredTotal < 0 || desiredTotal > MAX_STARTING_DAY) {
      showMessage(`Enter a valid day (0–${MAX_STARTING_DAY}).`, "error");
      return;
    }

    const curStreak = Number(state.current_streak || 0);
    const oldBase = Number(state.starting_day || 0);
    const oldTotal = oldBase + curStreak;

    if (desiredTotal < oldTotal) {
      const ok = confirm(`You’re lowering your displayed day from ${oldTotal} to ${desiredTotal}. Continue?`);
      if (!ok) return;
    }

    // Keep current_streak; adjust base so total becomes desiredTotal
    const newBase = Math.max(0, desiredTotal - curStreak);

    const next = { ...state, starting_day: newBase };
    if (!saveLocalState(next)) {
      showMessage("Could not save. Your browser may be blocking localStorage.", "error");
      return;
    }

    render(next);
    showMessage(`Streak updated. Now displaying Day ${desiredTotal}.`, "success");
  })
);

// ===============================
// CHECK IN
// ===============================
checkInBtn?.addEventListener("click", () =>
  guarded("checkIn", async () => {
    const state = loadLocalState();

    const input = sanitizeForStorage(identityInput?.value ?? "");
    if (!input.trim()) {
      showMessage("Type your identity statement before checking in.", "error");
      return;
    }

    const todayKey = getTodayKey();
    const nowTime = getTimeString();

    // If no identity saved yet, first check-in locks it and starts Day 1
    if (!String(state.identity_statement || "").trim()) {
      const next = {
        ...state,
        identity_statement: input,
        current_streak: 1,
        last_checkin_date: todayKey,
        last_checkin_time: nowTime,
      };

      if (!saveLocalState(next)) {
        showMessage("Could not save. Your browser may be blocking localStorage.", "error");
        return;
      }

      render(next);
      showMessage("Identity locked in. Day 1 of your NoFap + NoCorn streak has started.", "success");
      return;
    }

    // Already checked in today → update time only
    if (state.last_checkin_date === todayKey) {
      const next = { ...state, last_checkin_time: nowTime };

      if (!saveLocalState(next)) {
        showMessage("Could not save. Your browser may be blocking localStorage.", "error");
        return;
      }

      render(next);
      showMessage("You’ve already checked in today. Streak stays the same, time updated.", "success");
      return;
    }

    // Must match saved identity exactly (normalized)
    if (normalize(input) !== normalize(state.identity_statement)) throw new Error("IDENTITY_MISMATCH");

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

    const base = Number(next.starting_day || 0);
    showMessage(`Check-in logged. You are now on Day ${base + nextStreak}.`, "success");
  })
);

// ===============================
// SAVE / UPDATE IDENTITY
// ===============================
saveIdentityBtn?.addEventListener("click", () =>
  guarded("saveIdentity", async () => {
    const state = loadLocalState();

    const input = sanitizeForStorage(identityInput?.value ?? "");
    if (!input.trim()) {
      showMessage("Type an identity statement before saving.", "error");
      return;
    }

    const next = { ...state, identity_statement: input };

    if (!saveLocalState(next)) {
      showMessage("Could not save. Your browser may be blocking localStorage.", "error");
      return;
    }

    render(next);

    if (!String(state.identity_statement || "").trim()) {
      showMessage('Identity saved. Now retype it exactly and press "Check In" to start Day 1.', "success");
    } else {
      showMessage("Identity updated. Your streak stays the same.", "success");
    }
  })
);

// ===============================
// RESET STREAK (keeps identity)
// ===============================
resetStreakBtn?.addEventListener("click", () =>
  guarded("resetStreak", async () => {
    const state = loadLocalState();

    const ok = confirm(
      "Are you sure you want to reset your streak? This will set you back to Day 0, but will keep your identity statement."
    );
    if (!ok) return;

    const next = {
      ...state,
      current_streak: 0,
      starting_day: 0,
      last_checkin_date: null,
      last_checkin_time: null,
    };

    if (!saveLocalState(next)) {
      showMessage("Could not save. Your browser may be blocking localStorage.", "error");
      return;
    }

    render(next);
    showMessage("Streak reset to Day 0. Your identity statement is still saved.", "success");
  })
);

// ===============================
// CLEAR LOCAL DATA (module only)
// ===============================
btnClearLocal?.addEventListener("click", () =>
  guarded("clearLocal", async () => {
    const ok = confirm("Clear ALL local data for this module? This removes identity + streak from this device.");
    if (!ok) return;

    try {
      localStorage.removeItem(LS_KEY);
    } catch {}

    const fresh = defaultState();
    render(fresh);
    showMessage("Local data cleared for this module.", "success");
  })
);

// ===============================
// INIT
// ===============================
function init() {
  setButtonsDisabled(false);
  clearMessage();

  updateCharCount();
  identityInput?.addEventListener("input", updateCharCount);

  const state = loadLocalState();
  render(state);
}

init();
