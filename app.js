const TIMEZONES = [
  "UTC",
  "Europe/Moscow",
  "Europe/Amsterdam",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Dubai",
];

const PRESET_CITIES = [
  { city: "Москва", timezone: "Europe/Moscow" },
  { city: "Лондон", timezone: "Europe/London" },
  { city: "Нью-Йорк", timezone: "America/New_York" },
  { city: "Лос-Анджелес", timezone: "America/Los_Angeles" },
  { city: "Токио", timezone: "Asia/Tokyo" },
  { city: "Дубай", timezone: "Asia/Dubai" },
];

const state = {
  history: [],
  cityData: new Map(),
  selectedCities: new Set(),
  timers: {
    tick: null,
    sync: null,
  },
};

// Storage helpers
const storage = {
  readHistory() {
    try {
      const raw = localStorage.getItem("tz_history");
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },
  saveHistory(items) {
    localStorage.setItem("tz_history", JSON.stringify(items.slice(0, 10)));
  },
  readCities() {
    try {
      const raw = localStorage.getItem("tz_cities");
      return raw ? new Set(JSON.parse(raw)) : null;
    } catch (e) {
      return null;
    }
  },
  saveCities(set) {
    localStorage.setItem("tz_cities", JSON.stringify(Array.from(set)));
  },
};

// API client
const api = {
  async convert(payload) {
    const res = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Ошибка ${res.status}`);
    }
    return res.json();
  },
  async current(timezone) {
    const res = await fetch(`/api/current/${encodeURIComponent(timezone)}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Ошибка ${res.status}`);
    }
    return res.json();
  },
};

// Rendering helpers
function setStatus(el, type, message) {
  el.classList.remove("hidden", "success", "error", "info");
  el.classList.add(type);
  el.textContent = message;
}

function clearStatus(el) {
  el.classList.add("hidden");
  el.textContent = "";
}

function showToast(message, type = "error") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

function renderOptions(selectEl) {
  selectEl.innerHTML = TIMEZONES.map((tz) => `<option value="${tz}">${tz}</option>`).join("");
}

function renderHistory() {
  const list = document.getElementById("history-list");
  list.innerHTML = "";
  if (!state.history.length) {
    list.innerHTML = '<div class="placeholder">Пока пусто</div>';
    return;
  }
  state.history.forEach((item, idx) => {
    const el = document.createElement("div");
    el.className = "history-item";
    el.dataset.index = idx;
    el.innerHTML = `<div><strong>${item.datetime}</strong></div>
      <div class="muted">${item.from} → ${item.to}</div>
      <div class="muted">${item.result}</div>`;
    el.addEventListener("click", () => applyHistory(idx));
    list.appendChild(el);
  });
}

function renderResult(data) {
  const container = document.getElementById("convert-result");
  if (!data) {
    container.innerHTML = '<div class="placeholder">Результат появится здесь</div>';
    return;
  }
  container.innerHTML = `<h3>${data.friendly}</h3>
    <p class="muted">ISO: ${data.iso}</p>
    <p class="muted">Разница: ${data.diff}</p>`;
  container.classList.add("flash");
  setTimeout(() => container.classList.remove("flash"), 500);
}

function renderCities() {
  const wrapper = document.getElementById("cities");
  wrapper.innerHTML = "";
  const selected = Array.from(state.selectedCities);
  if (!selected.length) {
    wrapper.innerHTML = '<div class="placeholder">Нет выбранных городов</div>';
    return;
  }
  selected.forEach((tz) => {
    const data = state.cityData.get(tz);
    const cityInfo = PRESET_CITIES.find((c) => c.timezone === tz);
    const card = document.createElement("div");
    card.className = "city-card";
    if (!data) {
      card.innerHTML = `<div class="loading-skeleton" style="width:60%"></div>
        <div class="loading-skeleton" style="width:40%; margin-top:8px"></div>`;
    } else {
      card.innerHTML = `<div class="city-header">
          <h3 class="city-title">${cityInfo.city}</h3>
          <span class="tag">${tz}</span>
        </div>
        <div class="city-time">${data.displayTime}</div>
        <p class="city-date">${data.displayDate}</p>
        <div class="sync-info">Обновлено ${data.secondsAgo}s назад</div>`;
    }
    wrapper.appendChild(card);
  });
}

function renderCityModal() {
  const box = document.getElementById("city-checkboxes");
  box.innerHTML = "";
  PRESET_CITIES.forEach((city) => {
    const id = `city-${city.timezone}`;
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" id="${id}" value="${city.timezone}" ${
      state.selectedCities.has(city.timezone) ? "checked" : ""
    } /> <span>${city.city}</span> <span class="muted">(${city.timezone})</span>`;
    box.appendChild(label);
  });
}

function toggleModal(open) {
  const modal = document.getElementById("city-modal");
  modal.classList.toggle("hidden", !open);
}

function updateApiStatus(ok) {
  const el = document.getElementById("api-status");
  el.textContent = ok ? "API: доступно" : "API: недоступно";
  el.style.background = ok ? "#e8faf1" : "#fff1f1";
  el.style.color = ok ? "#0f5132" : "#842029";
}

// Event handlers
function applyHistory(index) {
  const item = state.history[index];
  if (!item) return;
  document.querySelector('[data-input="datetime"]').value = item.datetime;
  document.querySelector('[data-select="from"]').value = item.from;
  document.querySelector('[data-select="to"]').value = item.to;
  renderResult({ friendly: item.result, iso: item.iso, diff: item.diff });
}

async function handleConvert(e) {
  e.preventDefault();
  const datetime = document.querySelector('[data-input="datetime"]').value;
  const from = document.querySelector('[data-select="from"]').value;
  const to = document.querySelector('[data-select="to"]').value;
  const statusEl = document.getElementById("convert-status");
  const resultBox = document.getElementById("convert-result");

  if (!datetime) {
    showToast("Заполните дату и время", "error");
    return;
  }

  setStatus(statusEl, "info", "Конвертация…");
  resultBox.innerHTML = '<div class="loading-skeleton" style="height:24px"></div>';

  try {
    const payload = { datetime, fromTimezone: from, toTimezone: to };
    const data = await api.convert(payload);
    const friendly = new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "full",
      timeStyle: "medium",
      timeZone: data.output.timezone,
    }).format(new Date(data.output.iso));
    const diffHours = computeDiffHours(from, to, datetime, data.output.iso);
    const diffText = diffHours === null ? "—" : `Цель ${diffHours} от источника`;
    renderResult({ friendly, iso: data.output.iso, diff: diffText });
    setStatus(statusEl, "success", "Готово");
    const historyItem = {
      datetime,
      from,
      to,
      result: friendly,
      iso: data.output.iso,
      diff: diffText,
    };
    state.history = [historyItem, ...state.history].slice(0, 10);
    storage.saveHistory(state.history);
    renderHistory();
  } catch (error) {
    setStatus(statusEl, "error", error.message || "Ошибка конвертации");
    renderResult(null);
    showToast(error.message || "Не удалось конвертировать");
  }
}

function computeDiffHours(fromTz, toTz, sourceDt, targetIso) {
  try {
    const sourceDate = new Date(`${sourceDt}`);
    const sourceOffset = offsetAt(fromTz, sourceDate);
    const targetOffset = offsetAt(toTz, new Date(targetIso));
    const diff = (targetOffset - sourceOffset) / 60;
    if (!Number.isFinite(diff)) return null;
    const prefix = diff > 0 ? "+" : "";
    return `${prefix}${diff}h`;
  } catch (e) {
    return null;
  }
}

function offsetAt(timeZone, date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour").value);
  const minute = Number(parts.find((p) => p.type === "minute").value);
  const second = Number(parts.find((p) => p.type === "second").value);
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, second);
  const local = date.getTime();
  return (utc - local) / 60000;
}

function handleNow() {
  const input = document.querySelector('[data-input="datetime"]');
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  input.value = local;
}

function handleSwap() {
  const from = document.querySelector('[data-select="from"]');
  const to = document.querySelector('[data-select="to"]');
  const temp = from.value;
  from.value = to.value;
  to.value = temp;
}

function handleClear() {
  document.querySelector('[data-input="datetime"]').value = "";
  renderResult(null);
  clearStatus(document.getElementById("convert-status"));
}

function handleClearHistory() {
  state.history = [];
  storage.saveHistory(state.history);
  renderHistory();
}

async function fetchCity(timezone) {
  try {
    const data = await api.current(timezone);
    const now = new Date(data.now.iso);
    state.cityData.set(timezone, {
      date: now,
      iso: data.now.iso,
      lastSync: Date.now(),
      secondsAgo: 0,
      displayTime: formatTime(now, timezone),
      displayDate: formatDate(now, timezone),
    });
  } catch (error) {
    showToast(`Не удалось обновить ${timezone}: ${error.message}`);
  }
}

function formatTime(date, timeZone) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  }).format(date);
}

function formatDate(date, timeZone) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "full", timeZone }).format(date);
}

async function refreshCities() {
  const status = document.getElementById("city-status");
  setStatus(status, "info", "Обновление городов…");
  const selected = Array.from(state.selectedCities);
  await Promise.all(selected.map((tz) => fetchCity(tz)));
  clearStatus(status);
  renderCities();
}

function tickCities() {
  state.cityData.forEach((data, tz) => {
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - data.lastSync) / 1000);
    const projected = new Date(new Date(data.iso).getTime() + elapsed * 1000);
    state.cityData.set(tz, {
      ...data,
      secondsAgo: elapsed,
      displayTime: formatTime(projected, tz),
      displayDate: formatDate(projected, tz),
    });
  });
  renderCities();
}

function startTimers() {
  if (state.timers.tick) clearInterval(state.timers.tick);
  if (state.timers.sync) clearInterval(state.timers.sync);
  state.timers.tick = setInterval(tickCities, 1000);
  state.timers.sync = setInterval(refreshCities, 60000);
}

function handleManageCities() {
  renderCityModal();
  toggleModal(true);
}

function handleModalSubmit(e) {
  e.preventDefault();
  const inputs = document.querySelectorAll('#city-checkboxes input[type="checkbox"]');
  const selected = new Set();
  inputs.forEach((i) => i.checked && selected.add(i.value));
  state.selectedCities = selected;
  storage.saveCities(selected);
  toggleModal(false);
  refreshCities();
}

function handleModalClose() {
  toggleModal(false);
}

async function checkApiStatus() {
  try {
    await api.current("UTC");
    updateApiStatus(true);
  } catch (error) {
    updateApiStatus(false);
    showToast("API недоступно", "error");
  }
}

function bindEvents() {
  document.getElementById("convert-form").addEventListener("submit", handleConvert);
  document.querySelector('[data-action="now"]').addEventListener("click", handleNow);
  document.querySelector('[data-action="swap"]').addEventListener("click", handleSwap);
  document.querySelector('[data-action="clear"]').addEventListener("click", handleClear);
  document.querySelector('[data-action="clear-history"]').addEventListener("click", handleClearHistory);
  document.querySelector('[data-action="refresh-cities"]').addEventListener("click", refreshCities);
  document.querySelector('[data-action="manage-cities"]').addEventListener("click", handleManageCities);
  document.querySelectorAll('[data-action="close-modal"]').forEach((btn) =>
    btn.addEventListener("click", handleModalClose)
  );
  document.getElementById("city-form").addEventListener("submit", handleModalSubmit);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") toggleModal(false);
  });
}

function initSelects() {
  const from = document.querySelector('[data-select="from"]');
  const to = document.querySelector('[data-select="to"]');
  renderOptions(from);
  renderOptions(to);
  from.value = "UTC";
  to.value = "Europe/Moscow";
}

function initState() {
  state.history = storage.readHistory();
  const savedCities = storage.readCities();
  state.selectedCities = savedCities ?? new Set(PRESET_CITIES.map((c) => c.timezone));
  renderHistory();
  renderCities();
}

async function init() {
  initSelects();
  initState();
  bindEvents();
  handleNow();
  renderCityModal();
  await checkApiStatus();
  await refreshCities();
  startTimers();
}

document.addEventListener("DOMContentLoaded", init);
