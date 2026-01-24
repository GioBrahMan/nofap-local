// nofap.js (LOCAL ONLY) — NoFap + NoCorn identity + streak
// SAFE • MODULE-GUARDED • NO INPUT WIPES

console.log("nofap.js loaded (local)");

// ===============================
// MODULE GUARD
// ===============================
if (!document.body.classList.contains("module-nofap")) {
  console.warn("nofap.js aborted: wrong module");
  return;
}

// ===============================
// UI ELEMENTS
// ===============================
const identityInput = document.getElementById("socialIdentityInput");
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
if (yearNowEl) yearNowEl.textContent = String(new Date().getFullYear());

// ===============================
// CONSTANTS
// ===============================
const MAX_IDENTITY_LEN = 2000;
const MAX_STARTING_DAY = 5000;
const RATE_LIMIT_MS = 900;
const LS_KEY = "disciplineos_nofap_nocorn_v1";

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

  clearTimeout(showMessage._t);
  showMessage._t = setTimeout(() => {
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
  const d = !!disabled;
  checkInBtn && (checkInBtn.disabled = d);
  saveIdentityBtn && (saveIdentityBtn.disabled = d);
  resetStreakBtn && (resetStreakBtn.disabled = d);
  setStartingDayBtn && (setStartingDayBtn.disabled = d);
  identityInput && (identityInput.disabled = d);
  startingDayInput && (startingDayInput.disabled = d);
  btnClearLocal && (btnClearLocal.disabled = d);
}

function updateCharCount() {
  if (!identityInput || !charCountEl) return;
  charCountEl.textContent = `${identityInput.value.length}/${MAX_IDENTITY_LEN}`;
}

// ===============================
// NORMALIZATION
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
  return out.slice(0, MAX_IDENTITY_LEN);
}

// ===============================
// DATE / TIME
// ===============================
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTimeString() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function prettyDate(k) {
  if (!k) return "—";
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTimeAmPm(t) {
  if (!t) return "—";
  const [h, m, s] = t.split(":");
  const hh = Number(h);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return s ? `${h12}:${m}:${s} ${ampm}` : `${h12}:${m} ${ampm}`;
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
    return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
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
// RENDER (PURE)
// ===============================
function render(state) {
  savedIdentityText &&
    (savedIdentityText.textContent =
      state.identity_statement?.trim() ||
      "No identity saved yet. Your first check-in will lock it in.");

  const totalDay = Number(state.starting_day || 0) + Number(state.current_streak || 0);
  streakDayText && (streakDayText.textContent = `Day ${totalDay}`);

  lastCheckInText &&
    (lastCheckInText.textContent = state.last_checkin_date
      ? `Last Check-In: ${prettyDate(state.last_checkin_date)} · ${formatTimeAmPm(state.last_checkin_time)}`
      : "Last Check-In: —");

  startingDayInput && (startingDayInput.value = state.starting_day ? String(state.starting_day) : "");
}

// ===============================
// SINGLE-FLIGHT GUARD
// ===============================
async function guarded(name, fn) {
  const now = Date.now();
  if (now - lastActionAt < RATE_LIMIT_MS) {
    showMessage("Slow down — one action at a time.", "error");
    return;
  }
  lastActionAt = now;

  if (isProcessing) return;

  isProcessing = true;
  clearMessage();
  setButtonsDisabled(true);

  try {
    await fn();
  } catch (err) {
    showMessage(
      err?.message === "IDENTITY_MISMATCH"
        ? "Identity does not match exactly. Use Save / Update Identity."
        : "Operation failed. Please try again.",
      "error"
    );
    console.warn(name, err);
  } finally {
    isProcessing = false;
    setButtonsDisabled(false);
  }
}

// ===============================
// ACTIONS
// ===============================
saveIdentityBtn?.addEventListener("click", () =>
  guarded("saveIdentity", async () => {
    const state = loadLocalState();
    const input = sanitizeForStorage(identityInput?.value);

    if (!input.trim()) {
      showMessage("Type an identity statement before saving.", "error");
      return;
    }

    const next = { ...state, identity_statement: input };
    saveLocalState(next);
    render(next);

    identityInput.value = ""; // intentional clear
    updateCharCount();

    showMessage("Identity saved. Retype it exactly to check in.", "success");
  })
);

checkInBtn?.addEventListener("click", () =>
  guarded("checkIn", async () => {
    const state = loadLocalState();
    const input = sanitizeForStorage(identityInput?.value);

    if (!input.trim()) {
      showMessage("Type your identity statement before checking in.", "error");
      return;
    }

    const today = getTodayKey();
    const time = getTimeString();

    if (!state.identity_statement) {
      const next = {
        ...state,
        identity_statement: input,
        current_streak: 1,
        last_checkin_date: today,
        last_checkin_time: time,
      };
      saveLocalState(next);
      render(next);
      showMessage("Identity locked in. Day 1 started.", "success");
      return;
    }

    if (normalize(input) !== normalize(state.identity_statement)) {
      throw new Error("IDENTITY_MISMATCH");
    }

    if (state.last_checkin_date === today) {
      saveLocalState({ ...state, last_checkin_time: time });
      render({ ...state, last_checkin_time: time });
      showMessage("Already checked in today.", "success");
      return;
    }

    const next = {
      ...state,
      current_streak: state.current_streak + 1,
      last_checkin_date: today,
      last_checkin_time: time,
    };

    saveLocalState(next);
    render(next);
    showMessage(`Check-in logged. Day ${next.starting_day + next.current_streak}.`, "success");
  })
);

setStartingDayBtn?.addEventListener("click", () =>
  guarded("setStartingDay", async () => {
    const state = loadLocalState();
    const desired = parseInt(startingDayInput?.value ?? "", 10);

    if (Number.isNaN(desired) || desired < 0 || desired > MAX_STARTING_DAY) {
      showMessage(`Enter a valid day (0–${MAX_STARTING_DAY}).`, "error");
      return;
    }

    const newBase = Math.max(0, desired - state.current_streak);
    const next = { ...state, starting_day: newBase };

    saveLocalState(next);
    render(next);
    showMessage(`Now displaying Day ${desired}.`, "success");
  })
);

resetStreakBtn?.addEventListener("click", () =>
  guarded("resetStreak", async () => {
    const ok = confirm("Reset streak back to Day 0? Identity will be kept.");
    if (!ok) return;

    const state = loadLocalState();
    const next = {
      ...state,
      current_streak: 0,
      starting_day: 0,
      last_checkin_date: null,
      last_checkin_time: null,
    };

    saveLocalState(next);
    render(next);
    showMessage("Streak reset to Day 0.", "success");
  })
);

btnClearLocal?.addEventListener("click", () =>
  guarded("clearLocal", async () => {
    const ok = confirm("Clear ALL local data for this module?");
    if (!ok) return;

    localStorage.removeItem(LS_KEY);
    render(defaultState());
    showMessage("Local data cleared.", "success");
  })
);

// ===============================
// INIT
// ===============================
function init() {
  clearMessage();
  setButtonsDisabled(false);
  updateCharCount();
  identityInput?.addEventListener("input", updateCharCount);
  render(loadLocalState());
}

init();
