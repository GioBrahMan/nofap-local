// nosocial.js — LOCAL ONLY (with NoFap-style starterBox streak setter)

console.log("nosocial.js loaded");

// ===============================
// UI ELEMENTS
// ===============================
const input = document.getElementById("socialInput");

const streakDayText = document.getElementById("streakDayText");
const savedIdentityText = document.getElementById("savedIdentityText");
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
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowTime() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getPrettyDate(dateKey) {
  if (!dateKey) return "—";
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTimeAmPm(timeStr) {
  if (!timeStr) return "—";
  const [hhStr, mmStr] = String(timeStr).split(":");
  const hh = parseInt(hhStr, 10);
  const mm = mmStr ?? "00";
  if (Number.isNaN(hh)) return String(timeStr);
  const ampm = hh >= 12 ? "PM" : "AM";
  const hour12 = ((hh + 11) % 12) + 1;
  return `${hour12}:${mm} ${ampm}`;
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
  state.identity || "No statement saved yet.";
savedIdentityText.classList.remove("is-loading");

  streakDayText.textContent = `Day ${Number(state.streak || 0)}`;

  lastCheckInText.textContent = state.lastDate
    ? `Last Check-In: ${getPrettyDate(state.lastDate)} · ${formatTimeAmPm(state.lastTime)}`
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
      showMessage("Type your no social media statement first.", "error");
      return;
    }

    const state = load();
    state.identity = identity;

    save(state);
    render(state);
    showMessage("Statement saved.", "success");
  });

checkInBtn.onclick = () =>
  guarded(() => {
    const state = load();
    const text = normalize(input.value);

    if (!text) {
      showMessage("Type your no social media statement before checking in.", "error");
      return;
    }

    const today = todayKey();

    if (state.lastDate === today) {
      showMessage("Already checked in today.", "success");
      return;
    }

    if (!state.identity) {
      state.identity = text;
    } else if (normalize(state.identity) !== text) {
      showMessage("Statement does not match saved statement.", "error");
      return;
    }

    state.streak = Number(state.streak || 0) + 1;
    state.lastDate = today;
    state.lastTime = nowTime();
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

