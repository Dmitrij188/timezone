const TIMEZONES = [
  { label: "Europe/Moscow", tz: "Europe/Moscow" },
  { label: "Europe/London", tz: "Europe/London" },
  { label: "America/New_York", tz: "America/New_York" },
  { label: "America/Los_Angeles", tz: "America/Los_Angeles" },
  { label: "Asia/Tokyo", tz: "Asia/Tokyo" },
  { label: "Asia/Dubai", tz: "Asia/Dubai" },
];

const worldList = document.getElementById("world-list");
const datetimeInput = document.getElementById("datetime-input");
const fromSelect = document.getElementById("from-tz");
const toSelect = document.getElementById("to-tz");
const convertForm = document.getElementById("convert-form");
const convertResult = document.getElementById("convert-result");

function pad(value) {
  return value.toString().padStart(2, "0");
}

function formatIso(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function renderSelectOptions() {
  TIMEZONES.forEach(({ label, tz }) => {
    const optionFrom = document.createElement("option");
    optionFrom.value = tz;
    optionFrom.textContent = label;
    fromSelect.appendChild(optionFrom);

    const optionTo = document.createElement("option");
    optionTo.value = tz;
    optionTo.textContent = label;
    toSelect.appendChild(optionTo);
  });
  fromSelect.value = TIMEZONES[0].tz;
  toSelect.value = TIMEZONES[1].tz;
}

async function fetchCurrentTime(tz) {
  const url = `/api/current/${encodeURIComponent(tz)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to fetch ${tz}`);
  }
  return response.json();
}

async function loadClocks() {
  worldList.innerHTML = "";
  for (const { label, tz } of TIMEZONES) {
    const row = document.createElement("div");
    row.className = "clock-row";
    row.textContent = `${label} — loading...`;
    worldList.appendChild(row);

    try {
      const data = await fetchCurrentTime(tz);
      const formatted = formatIso(data.iso);
      row.textContent = `${label} — ${formatted || data.iso}`;
    } catch (error) {
      console.error("Clock error", error);
      row.textContent = `${label} — Ошибка (${error.message})`;
    }
  }
}

async function handleConvert(event) {
  event.preventDefault();
  convertResult.textContent = "";
  const dt = datetimeInput.value;
  const from = fromSelect.value;
  const to = toSelect.value;

  if (!dt) {
    convertResult.textContent = "Please provide a date and time.";
    return;
  }

  try {
    const response = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dt, from, to }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Conversion failed");
    }
    const data = await response.json();
    const formatted = formatIso(data.iso);
    convertResult.innerHTML = `Target time: ${formatted}<br>ISO: ${data.iso}<br>Epoch: ${data.epoch}`;
  } catch (error) {
    console.error("Conversion error", error);
    convertResult.textContent = `Error: ${error.message}`;
  }
}

renderSelectOptions();
loadClocks();
setInterval(loadClocks, 25000);
convertForm.addEventListener("submit", handleConvert);
