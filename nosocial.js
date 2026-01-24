// nosocial.js (LOCAL ONLY) — Healthy Social Media: creators + identity + streak
// SAFE • NO INPUT WIPES • MODULE-GUARDED

console.log("nosocial.js loaded (local)");

// ===============================
// MODULE GUARD (prevents cross-page bugs)
// ===============================
if (!document.body.classList.contains("module-nosocial")) {
  console.warn("nosocial.js aborted: wrong module");
  return;
}

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
// CONSTANTS
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
  slipBtn && (slipBtn.disabled = d);
  sitesInput && (sitesInput.disabled = d);
  identityInput && (identityInput.disabled = d);
}

// ===============================
// NORMALIZATION / SANITIZATION
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
  return out.slice(0, maxLen);
}

// ===============================
// CREATORS HELPERS
// ===============================
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

function formatTimeAmPm(t) {
  if (!t) return "—";
  const [h, m, s] = t.split(":");
  const hh = Number(h);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return s ? `${h12}:${m}:${s} ${ampm}` : `${h12}:${m} ${ampm}`;
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
// RENDER (PURE — NO INPUT MUTATION)
// ===============================
function render(state) {
  savedIdentityText?.classList.remove("is-loading");
  savedSitesText?.classList.remove("is-loading");

  savedIdentityText && (savedIdentityText.textContent =
    state.identity_statement?.trim() ||
    "No identity saved yet. Your first check-in will lock it in.");

  savedSitesText && (savedSitesText.textContent =
    creatorsArrayToText(state.allowed_creators) ||
    "No content creators listed yet.");

  streakDayText && (streakDayText.textContent = `Day ${state.current_streak || 0}`);

  lastCheckInText &&
    (lastCheckInText.textContent = state.last_checkin_date
      ? `Last Check-In: ${prettyDate(state.last_checkin_date)} · ${formatTimeAmPm(state.last_checkin_time)}`
      : "Last Check-In: —");
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
    const identity = sanitizeForStorage(identityInput?.value);

    if (!identity.trim()) {
      showMessage("Type an identity statement before saving.", "error");
      return;
    }

    const next = {
      ...state,
      identity_statement: identity,
      allowed_creators: creatorsTextToArray(sitesInput?.value),
    };

    if (!saveLocalState(next)) {
      showMessage("Could not save. Storage blocked.", "error");
      return;
    }

    render(next);

    // intentional clear AFTER success
    identityInput.value = "";
    sitesInput.value = "";

    showMessage("Identity + creators saved.", "success");
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
        allowed_creators: creatorsTextToArray(sitesInput?.value),
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

    const next = {
      ...state,
      current_streak: state.current_streak + 1,
      last_checkin_date: today,
      last_checkin_time: time,
    };

    saveLocalState(next);
    render(next);
    showMessage(`Check-in logged. Day ${next.current_streak}.`, "success");
  })
);

slipBtn?.addEventListener("click", () =>
  guarded("slip", async () => {
    const ok = confirm("Mark today as a slip and reset your streak?");
    if (!ok) return;

    const state = loadLocalState();
    const next = {
      ...state,
      current_streak: 0,
      last_checkin_date: null,
      last_checkin_time: null,
    };

    saveLocalState(next);
    render(next);
    showMessage("Slip recorded. Back to Day 0.", "success");
  })
);

// ===============================
// INIT
// ===============================
function init() {
  clearMessage();
  setButtonsDisabled(false);
  render(loadLocalState());
}

init();
