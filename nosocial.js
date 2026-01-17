// nosocial.js (LOCAL ONLY) — creators list + identity + streak

console.log("nosocial.js loaded (local)");

// ===============================
// UI ELEMENTS
// ===============================
const sitesInput = document.getElementById("sitesInput");
const identityInput = document.getElementById("identityInput");

const streakDayText = document.getElementById("streakDayText");
const savedIdentityText = document.getElementById("savedIdentityText");
const savedSitesText = document.getElementById("savedSitesText");
const lastCheckInText = document.getElementById("lastCheckInText");
const messageEl = document.getElementById("message");

const checkInBtn = document.getElementById("checkInBtn");
const saveIdentityBtn = document.getElementById("saveIdentityBtn");
const slipBtn = document.getElementById("slipBtn");

// ===============================
// CONSTANTS / LIMITS
// ===============================
const MAX_IDENTITY_LEN = 2000;
const MAX_CREATORS = 50;
const RATE_LIMIT_MS = 900;
const LS_KEY = "disciplineos_no_social_v1";

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
  messageEl.style.display = "block";

  window.clearTimeout(showMessage._t);
  showMessage._t = window.setTimeout(() => {
    messageEl.classList.add("is-hidden");
    messageEl.style.display = "none";
  }, 5000);
}

function clearMessage() {
  if (!messageEl) return;
  messageEl.textContent = "";
  messageEl.classList.add("is-hidden");
  messageEl.classList.remove("success", "error");
  messageEl.style.display = "none";
}

function setButtonsDisabled(disabled) {
  const ds = !!disabled;
  checkInBtn && (checkInBtn.disabled = ds);
  saveIdentityBtn && (saveIdentityBtn.disabled = ds);
  slipBtn && (slipBtn.disabled = ds);
  sitesInput && (sitesInput.disabled = ds);
  identityInput && (identityInput.disabled = ds);
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

function sanitizeForStorage(s, maxLen = MAX_IDENTITY_LEN) {
  let out = normalize(s);
  out = out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  out = out.replace(/[\u200B-\u200F\uFEFF]/g, "");
  if (out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

// creators textarea -> array
function creatorsTextToArray(text) {
  return String(text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_CREATORS);
}
function creatorsArrayToText(arr) {
  return Array.isArray(arr) ? arr.join("\n") : "";
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
    allowed_creators: [],
    identity_statement: "",
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
  savedIdentityText?.classList.remove("is-loading");
  savedSitesText?.classList.remove("is-loading");

  const identityRaw = String(state.identity_statement ?? "");
  const identity = identityRaw.trim()
    ? identityRaw
    : "No identity saved yet. Your first check-in will lock it in.";
  if (savedIdentityText) savedIdentityText.textContent = identity;

  const creatorsText = creatorsArrayToText(state.allowed_creators);
  const creators = creatorsText.trim()
    ? creatorsText
    : "No content creators listed yet. Start by naming the creators you enjoy watching or add value to your life.";
  if (savedSitesText) savedSitesText.textContent = creators;

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

  // optional: clear inputs after render
  if (sitesInput) sitesInput.value = "";
  if (identityInput) identityInput.value = "";
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
    const raw = String(err?.message || "").toLowerCase();
    if (raw.includes("identity_mismatch")) {
      showMessage('This doesn’t match your saved identity statement exactly. Use "Save / Update Identity" if you changed it.', "error");
    } else {
      showMessage("Operation failed. Please try again.", "error");
    }
    console.warn(`${actionName} failed.`, err);
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

    const identityRaw = sanitizeForStorage(identityInput?.value ?? "", MAX_IDENTITY_LEN);
    if (!identityRaw.trim()) {
      showMessage("Type an identity statement before saving.", "error");
      return;
    }

    const allowedCreators = creatorsTextToArray(sitesInput?.value ?? "");

    const next = {
      ...state,
      allowed_creators: allowedCreators,
      identity_statement: identityRaw,
    };

    if (!saveLocalState(next)) {
      showMessage("Could not save. Your browser may be blocking localStorage.", "error");
      return;
    }

    render(next);
    showMessage("Identity + creators saved. Your streak stays the same.", "success");
  })
);

checkInBtn?.addEventListener("click", () =>
  guarded("checkIn", async () => {
    const state = loadLocalState();

    const input = sanitizeForStorage(identityInput?.value ?? "", MAX_IDENTITY_LEN);
    if (!input.trim()) {
      showMessage("Type your Healthy Social Media identity statement before checking in.", "error");
      return;
    }

    const todayKey = getTodayKey();
    const nowTime = getTimeString();

    // first time: lock identity + creators and start Day 1
    if (!String(state.identity_statement || "").trim()) {
      const allowedCreators = creatorsTextToArray(sitesInput?.value ?? "");
      const next = {
        ...state,
        allowed_creators: allowedCreators,
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
      showMessage("Identity locked in. Day 1 of your Healthy Social Media streak has started.", "success");
      return;
    }

    // already checked in today -> update time only
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

    // must match identity exactly
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
    showMessage(`Check-in logged. You are now on Day ${nextStreak}.`, "success");
  })
);

slipBtn?.addEventListener("click", () =>
  guarded("slip", async () => {
    const state = loadLocalState();
    const ok = confirm("Mark today as a slip and reset your Healthy Social Media streak back to Day 0?");
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
    showMessage("You marked a slip. Streak reset to Day 0. We rebuild from zero.", "success");
  })
);

// ===============================
// INIT
// ===============================
function init() {
  setButtonsDisabled(false);
  clearMessage();
  render(loadLocalState());
}
init();
