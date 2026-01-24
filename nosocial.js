// nosocial.js — LOCAL ONLY (Monk Mode style)

console.log("nosocial.js loaded");

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

const LS_KEY = "disciplineos_social_v1";
const RATE_LIMIT_MS = 900;

let isProcessing = false;
let lastActionAt = 0;

// ---------- helpers ----------
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

function load() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {
      identity: "",
      creators: [],
      streak: 0,
      lastDate: null,
      lastTime: null,
    };
  } catch {
    return { identity: "", creators: [], streak: 0, lastDate: null, lastTime: null };
  }
}

function save(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ---------- render ----------
function render(state) {
  savedIdentityText.textContent =
    state.identity || "No identity saved yet.";

  savedSitesText.textContent =
    state.creators.length ? state.creators.join("\n") : "No creators saved.";

  streakDayText.textContent = `Day ${state.streak}`;

  lastCheckInText.textContent = state.lastDate
    ? `Last Check-In: ${state.lastDate} · ${state.lastTime}`
    : "Last Check-In: —";
}

// ---------- guard ----------
async function guarded(fn) {
  const now = Date.now();
  if (now - lastActionAt < RATE_LIMIT_MS || isProcessing) return;
  lastActionAt = now;
  isProcessing = true;
  try {
    await fn();
  } finally {
    isProcessing = false;
  }
}

// ---------- actions ----------
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

    if (!state.identity) {
      state.identity = text;
      state.creators = normalize(sitesInput.value).split("\n").filter(Boolean);
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

slipBtn.onclick = () =>
  guarded(() => {
    if (!confirm("Mark today as a slip and reset streak?")) return;
    const state = load();
    state.streak = 0;
    state.lastDate = null;
    state.lastTime = null;
    save(state);
    render(state);
    showMessage("Slip recorded. Streak reset.", "success");
  });

// ---------- init ----------
render(load());
