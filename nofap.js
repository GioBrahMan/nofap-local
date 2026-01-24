console.log("nofap.js loaded");

/* =========================
   ELEMENTS
========================= */
const input = document.getElementById("identityInput");
const streakDayText = document.getElementById("streakDayText");
const savedIdentityText = document.getElementById("savedIdentityText");
const lastCheckInText = document.getElementById("lastCheckInText");
const messageEl = document.getElementById("message");
const charCount = document.getElementById("charCount");
const yearNow = document.getElementById("yearNow");

const checkInBtn = document.getElementById("checkInBtn");
const saveBtn = document.getElementById("saveIdentityBtn");
const resetBtn = document.getElementById("resetStreakBtn");

const startingDayInput = document.getElementById("startingDayInput");
const setStartingDayBtn = document.getElementById("setStartingDayBtn");

/* =========================
   STORAGE
========================= */
const KEY = "disciplineos_nofap_local";

function defaultState() {
  return {
    identity: "",
    streak: 0,
    lastDate: null,
    lastTime: null,
    baseLocked: false,
  };
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || defaultState();
  } catch {
    return defaultState();
  }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

/* =========================
   HELPERS
========================= */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showMessage(text, type = "success") {
  messageEl.textContent = text;
  messageEl.classList.remove("is-hidden", "success", "error");
  messageEl.classList.add(type);

  clearTimeout(showMessage._t);
  showMessage._t = setTimeout(() => {
    messageEl.classList.add("is-hidden");
  }, 3500);
}

/* =========================
   RENDER
========================= */
function render() {
  const state = load();

  streakDayText.textContent = `Day ${state.streak}`;

  savedIdentityText.textContent =
    state.identity || "No identity saved yet.";
  savedIdentityText.classList.remove("is-loading");

  lastCheckInText.textContent = state.lastDate
    ? `Last Check-In: ${state.lastDate} · ${state.lastTime}`
    : "Last Check-In: —";

  charCount.textContent = `${input.value.length}/2000`;
  yearNow.textContent = new Date().getFullYear();

  // lock starter if needed
  startingDayInput.disabled = state.baseLocked;
  setStartingDayBtn.disabled = state.baseLocked;
  if (state.baseLocked) {
    startingDayInput.placeholder = "Locked";
  }
}

/* =========================
   ACTIONS
========================= */
saveBtn.onclick = () => {
  const text = input.value.trim();
  if (!text) {
    showMessage("Type an identity statement first.", "error");
    return;
  }

  const state = load();
  state.identity = text;
  save(state);
  render();
  showMessage("Identity saved.");
};

checkInBtn.onclick = () => {
  const text = input.value.trim();
  if (!text) {
    showMessage("Type your identity before checking in.", "error");
    return;
  }

  const state = load();
  const today = todayKey();

  if (state.lastDate === today) {
    showMessage("Already checked in today.");
    return;
  }

  state.identity = text;
  state.streak += 1;
  state.lastDate = today;
  state.lastTime = nowTime();
  state.baseLocked = true;

  save(state);
  render();
  showMessage(`Check-in logged. Day ${state.streak}.`);
};

resetBtn.onclick = () => {
  localStorage.removeItem(KEY);
  render();
  showMessage("Streak reset.", "error");
};

setStartingDayBtn.onclick = () => {
  const v = Number(startingDayInput.value);
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
  render();
  showMessage(`Starting streak set to Day ${state.streak}.`);
};

/* =========================
   EVENTS
========================= */
input.addEventListener("input", () => {
  charCount.textContent = `${input.value.length}/2000`;
});

/* =========================
   INIT
========================= */
render();
