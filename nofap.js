// nofap.js — LOCAL ONLY (Monk Mode style)

console.log("nofap.js loaded");

// ===============================
// UI ELEMENTS
// ===============================
const input = document.getElementById("nofapInput");

const streakDayText = document.getElementById("streakDayText");
const savedIdentityText = document.getElementById("savedIdentityText");
const lastCheckInText = document.getElementById("lastCheckInText");
const messageEl = document.getElementById("message");

const checkInBtn = document.getElementById("checkInBtn");
const saveBtn = document.getElementById("saveIdentityBtn");
const resetBtn = document.getElementById("resetStreakBtn");

// ===============================
// CONSTANTS
// ===============================
const LS_KEY = "disciplineos_nofap_v1";
const RATE_LIMIT_MS = 900;

let isProcessing = false;
let lastActionAt = 0;

// ===============================
// HELPERS
// ===============================
function showMessage(text, type = "success") {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.classList.remove("is-hidden", "success", "error");
  messageEl.classList.add(type);
  clearTimeout(showMessage._t);
  showMessage._t = setTimeout(() => {
    messageEl.classList.add("is-hidden");
  }, 5000);
}

function normalize(s) {
  return String(s ?? "").replace(/\r\n/g, "\n").trim();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function timeNow() {
  return new Date().toTimeString().slice(0, 8);
}

// ===============================
// STORAGE
// ===============================
function defaultState() {
  return {
    identity: "",
    streak: 0,
    lastDate: null,
    lastTime: null,
  };
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || defaultState();
  } catch {
    return defaultState();
  }
}

function save(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ===============================
// RENDER (Monk Mode style)
// ===============================
function render(state) {
  savedIdentityText.textContent =
    state.identity || "No identity saved yet. Your first check-in will lock it in.";
  savedIdentityText.classList.remove("is-loading");

  streakDayText.textContent = `Day ${state.streak}`;

  lastCheckInText.textContent = state.lastDate
    ? `Last Check-In: ${state.lastDate} · ${state.lastTime}`
    : "Last Check-In: —";
}

// ===============================
// GUARD
// ===============================
async function guarded(fn) {
  const now = Date.now();
  if (isProcessing || now - lastActionAt < RATE_LIMIT_MS) return;
  lastActionAt = now;
  isProcessing = true;
  try {
    await fn();
  } finally {
    isProcessing = false;
  }
}

// ===============================
// ACTIONS
// ===============================
saveBtn.onclick = () =>
  guarded(() => {
    const text = normalize(input.value);
    if (!text) {
      showMessage("Type an identity statement first.", "error");
      return;
    }

    const state = load();
    state.identity = text;
    save(state);
    render(state);
    showMessage("Identity saved.", "success");
  });

checkInBtn.onclick = () =>
  guarded(() => {
    const state = load();
    const text = normalize(input.value);
    if (!text) {
      showMessage("Type your identity before checking in.", "error");
      return;
    }

    const today = todayKey();

    if (!state.identity) {
      state.identity = text;
      state.streak = 1;
    } else {
      if (normalize(state.identity) !== text) {
        showMessage("Identity does not match saved statement.", "error");
        return;
      }
      if (state.lastDate === today) {
        showMessage("Already checked in today.", "success");
        return;
      }
      state.streak += 1;
    }

    state.lastDate = today;
    state.lastTime = timeNow();
    save(state);
    render(state);
    showMessage(`Check-in logged. Day ${state.streak}.`, "success");
  });

resetBtn.onclick
