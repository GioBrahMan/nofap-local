// lastlog.js — LOCAL-ONLY
(() => {
  // Storage keys (unique to this module)
  const K_LASTLOG_TEXT = "disciplineos_lastlog_text";
  const K_LASTLOG_SAVED_AT = "disciplineos_lastlog_savedAt";

  // Elements
  const input = document.getElementById("lastLogInput");
  const savedText = document.getElementById("savedLogText");
  const msg = document.getElementById("message");
  const lastSavedText = document.getElementById("lastSavedText");

  const saveBtn = document.getElementById("saveBtn");
  const clearBtn = document.getElementById("clearBtn");
  const templateBtn = document.getElementById("templateBtn");

  const yearNow = document.getElementById("yearNow");

  // Helpers
  const nowISO = () => new Date().toISOString();

  const fmtLocal = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const showMessage = (type, text) => {
    msg.classList.remove("is-hidden", "success", "error");
    msg.classList.add(type === "error" ? "error" : "success");
    msg.textContent = text;

    // auto-hide
    window.clearTimeout(showMessage._t);
    showMessage._t = window.setTimeout(() => {
      msg.classList.add("is-hidden");
    }, 2200);
  };

  const setMirror = (text) => {
    const cleaned = (text || "").trim();
    if (!cleaned) {
      savedText.textContent = "No log saved yet.";
      savedText.classList.remove("is-loading");
      return;
    }
    savedText.textContent = cleaned;
    savedText.classList.remove("is-loading");
  };

  const load = () => {
    yearNow.textContent = String(new Date().getFullYear());

    const text = localStorage.getItem(K_LASTLOG_TEXT) || "";
    const savedAt = localStorage.getItem(K_LASTLOG_SAVED_AT) || "";

    input.value = text;
    setMirror(text);

    lastSavedText.textContent = `Last Saved: ${savedAt ? fmtLocal(savedAt) : "—"}`;
  };

  const save = () => {
    const text = input.value || "";
    localStorage.setItem(K_LASTLOG_TEXT, text);
    localStorage.setItem(K_LASTLOG_SAVED_AT, nowISO());

    setMirror(text);
    lastSavedText.textContent = `Last Saved: ${fmtLocal(localStorage.getItem(K_LASTLOG_SAVED_AT))}`;

    const trimmed = text.trim();
    showMessage("success", trimmed ? "Saved." : "Saved (empty).");
  };

  const clearAll = () => {
    input.value = "";
    localStorage.removeItem(K_LASTLOG_TEXT);
    localStorage.removeItem(K_LASTLOG_SAVED_AT);

    setMirror("");
    lastSavedText.textContent = "Last Saved: —";
    showMessage("success", "Cleared.");
  };

  const insertTemplate = () => {
    const template =
`last fap — 
last corn/porn — 
last movie/tv — 
last junk drink — 
last junk snack — 
last doomscroll — 
last slept-in/snooze — 
notes (optional) — `;

    // If empty, drop template. If not empty, append with a divider.
    const current = (input.value || "").trim();
    input.value = current
      ? `${current}\n\n---\n${template}`
      : template;

    showMessage("success", "Template inserted.");
  };

  // Events
  saveBtn.addEventListener("click", save);
  clearBtn.addEventListener("click", clearAll);
  templateBtn.addEventListener("click", insertTemplate);

  // Ctrl/Cmd+S quick-save
  document.addEventListener("keydown", (e) => {
    const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
    if (isSave) {
      e.preventDefault();
      save();
    }
  });

  // Init
  load();
})();
