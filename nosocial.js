// nosocial.js — LOCAL ONLY (with NoFap-style starterBox streak setter)

console.log("nosocial.js loaded");

// ===============================
// UI ELEMENTS
// ===============================
const sitesInput = document.getElementById("sitesInput");
const input = document.getElementById("socialInput");

const streakDayText = document.getElementById("streakDayText");
const savedIdentityText = document.getElementById("savedIdentityText");
const savedSitesText = document.getElementById("savedSitesText");
const lastCheckInText = document.getElementById("lastCheckInText");
const messageEl = document.getElementById("message");

const checkInBtn = document.getElementById("checkInBtn");
const saveBtn = document.getElementById("saveIdentityBtn");
const slipBtn = document.getElementById("slipBtn");

// Starter box (mirrors NoFap)
const startingDayInput = document.getElementById("startingDayInput");
const setStartingDayBtn = document.getElementById("setStartingDayBtn");

// ===============================
// CONSTANTS
// ===============================
const LS_KEY = "disciplineos_social_v1";
const RATE_LIMIT_MS = 900;

let isProcessing = false;
let lastActionAt = 0;

// ===============================
// HELPERS
// ===============================
function showMessage(text, type = "success") {
  if (!messageEl) return;
  messageEl.textContent = String(text || "");
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
    creators: [],
    streak: 0,
    lastDate: null,
    lastTime: null,

    // mirrors NoFap
    baseLocked: false,
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
// RENDER
// ===============================
function render(state) {
  savedIdentityText.textContent =
    state.identity || "No identity saved yet. Your first check-in will lock it in.";
  savedIdentityText.classList.remove("is-loading");

  savedSitesText.textContent =
    state.creators.length ? state.creators.join("\n") : "No creators saved yet.";
  savedSitesText.classList.remove("is-loading");

  streakDayText.textContent = `Day ${Number(state.streak || 0)}`;

  lastCheckInText.textContent = state.lastDate
    ? `Last Check-In: ${state.lastDate} · ${state.lastTime}`
    : "Last Check-In: —";

  // Starter box lock (mirrors NoFap)
  if (startingDayInput && setStartingDayBtn) {
    startingDayInput.disabled = !!state.baseLocked;
    setStartingDayBtn.disabled = !!state.baseLocked;
    if (state.baseLocked) startingDayInput.placeholder = "Locked";
  }
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
    const identity = normalize(input.value);
    if (!identity) {
      showMessage("Type an identity statement first.", "error");
      return;
    }

    const state = load();
    state.identity = identity;
    state.creators = normalize(sitesInput.value)
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    save(state);
    render(state);
    showMessage("Identity + creators saved.", "success");
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

    if (state.lastDate === today) {
      showMessage("Already checked in today.", "success");
      return;
    }

    // If first time, lock in identity + creators
    if (!state.identity) {
      state.identity = text;
      state.creators = normalize(sitesInput.value)
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);

      // If streak is 0, start at 1; if you set a base earlier, this will go base+1
      state.streak = Number(state.streak || 0) + 1;
    } else {
      if (normalize(state.identity) !== text) {
        showMessage("Identity does not match saved statement.", "error");
        return;
      }
      state.streak = Number(state.streak || 0) + 1;
    }

    state.lastDate = today;
    state.lastTime = timeNow();

    // lock starter base after first check-in
    state.baseLocked = true;

    save(state);
    render(state);
    showMessage(`Check-in logged. Day ${state.streak}.`, "success");
  });

slipBtn.onclick = () =>
  guarded(() => {
    if (!confirm("Mark today as a slip and reset your streak?")) return;
    const state = load();
    state.streak = 0;
    state.lastDate = null;
    state.lastTime = null;

    // mirror NoFap: full reset unlocks base setter again
    state.baseLocked = false;

    save(state);
    render(state);
    showMessage("Slip recorded. Streak reset.", "success");
  });

// StarterBox: Set Starting Day (mirrors NoFap)
setStartingDayBtn?.addEventListener("click", () =>
  guarded(() => {
    const v = Number(startingDayInput?.value);
    if (!Number.isFinite(v) || v < 0 || v > 5000) {
      showMessage("Enter a valid number (0–5000).", "error");
      return;
    }

    const state = load();
    if (state.baseLocked) {
      showMessage("Base streak is locked.", "error");
      return;
    }

    state.streak = Math.floor(v);
    state.baseLocked = true;

    save(state);
    if (startingDayInput) startingDayInput.value = "";
    render(state);
    showMessage(`Starting streak set to Day ${state.streak}.`, "success");
  })
);

// ===============================
// INIT
// ===============================
render(load());

