const els = {
  connection: document.getElementById("connection"),
  updated: document.getElementById("updated"),
  emoji: document.getElementById("emoji"),
  moodText: document.getElementById("moodText"),
  moodNote: document.getElementById("moodNote"),
  intensityFill: document.getElementById("intensityFill"),
  intensityLabel: document.getElementById("intensityLabel"),
  historyList: document.getElementById("historyList"),
};

const THEME_KEY = "moodtracker-theme";
let lastUpdatedAt = null;

function formatWhen(iso) {
  if (!iso) return "чекаємо перший сигнал";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "щойно оновлено";
  if (minutes < 60) return `${minutes} хв тому`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} год тому`;

  return date.toLocaleString("uk-UA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setConnection(online) {
  els.connection.textContent = online ? "онлайн" : "перепідключення";
  document.querySelector(".live-dot")?.classList.toggle("is-offline", !online);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMood(mood) {
  if (!mood) return;

  lastUpdatedAt = mood.updatedAt || null;
  els.emoji.textContent = mood.emoji || "☁️";
  els.moodText.textContent = mood.text || "ще тихо";
  els.moodNote.textContent = mood.note || "напиши боту свій настрій";
  els.updated.textContent = formatWhen(mood.updatedAt);

  const intensity = Number(mood.intensity) || 5;
  els.intensityFill.style.width = `${intensity * 10}%`;
  els.intensityLabel.textContent = `${intensity} / 10`;

  els.moodText.animate(
    [
      { opacity: 0.35, transform: "translateY(10px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
  );

  const history = Array.isArray(mood.history) ? mood.history : [];
  els.historyList.innerHTML = history
    .map(
      (item) => `
      <li class="history-item">
        <span aria-hidden="true">${item.emoji || "☁️"}</span>
        <div>
          <strong>${escapeHtml(item.text)}</strong>
          ${item.note ? `<div><span>${escapeHtml(item.note)}</span></div>` : ""}
        </div>
        <span>${formatWhen(item.updatedAt)}</span>
      </li>
    `
    )
    .join("");
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);

  for (const button of document.querySelectorAll(".theme-btn")) {
    button.classList.toggle("is-active", button.dataset.theme === theme);
  }
}

function initThemes() {
  applyTheme(localStorage.getItem(THEME_KEY) || "lagoon");

  document.querySelector(".themes")?.addEventListener("click", (event) => {
    const button = event.target.closest(".theme-btn");
    if (!button) return;
    applyTheme(button.dataset.theme);
  });
}

async function loadInitial() {
  try {
    const response = await fetch("/api/mood");
    if (!response.ok) throw new Error("bad response");
    renderMood(await response.json());
    setConnection(true);
  } catch {
    setConnection(false);
  }
}

function connectStream() {
  const source = new EventSource("/api/stream");

  source.onopen = () => setConnection(true);
  source.onmessage = (event) => {
    try {
      renderMood(JSON.parse(event.data));
      setConnection(true);
    } catch (error) {
      console.error(error);
    }
  };
  source.onerror = () => {
    setConnection(false);
    source.close();
    setTimeout(connectStream, 2500);
  };
}

initThemes();
await loadInitial();
connectStream();
setInterval(() => {
  if (lastUpdatedAt) els.updated.textContent = formatWhen(lastUpdatedAt);
}, 30000);
