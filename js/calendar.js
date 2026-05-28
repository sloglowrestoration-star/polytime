export const DAYS = ["M","T","W","R","F"];
export const DAY_LABELS = { M:"Mon", T:"Tue", W:"Wed", R:"Thu", F:"Fri" };
export const START_MIN = 7 * 60;   // 07:00
export const END_MIN   = 21 * 60;  // 21:00
export const SLOT_MIN  = 30;
export const SLOT_COUNT = (END_MIN - START_MIN) / SLOT_MIN; // 28

export function timeToSlot(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return Math.floor((h * 60 + m - START_MIN) / SLOT_MIN);
}
export function slotToTime(slot) {
  const total = START_MIN + slot * SLOT_MIN;
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}
export function blockKey(day, slot) { return `${day}:${slot}`; }

// --- block store ---
const _blocks = new Set();
export function getBlocks() { return _blocks; }
export function clearBlocks() { _blocks.clear(); renderBlocks(_blocks); }

// --- grid render ---
export function initCalendar(containerId = "calendar") {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  // header row: blank corner + day labels
  const corner = document.createElement("div");
  corner.className = "cal-header";
  corner.textContent = "";
  container.appendChild(corner);
  DAYS.forEach(d => {
    const h = document.createElement("div");
    h.className = "cal-header";
    h.textContent = DAY_LABELS[d];
    container.appendChild(h);
  });
  // body: for each slot row, a time label then 5 day cells
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const label = document.createElement("div");
    label.className = "cal-time-label";
    label.textContent = slot % 2 === 0 ? slotToTime(slot) : "";
    container.appendChild(label);
    DAYS.forEach(day => {
      const cell = document.createElement("div");
      cell.className = "cal-cell";
      cell.dataset.day = day;
      cell.dataset.slot = String(slot);
      container.appendChild(cell);
    });
  }
}

export function renderBlocks(blocks) {
  document.querySelectorAll(".cal-cell").forEach(cell => {
    const key = blockKey(cell.dataset.day, Number(cell.dataset.slot));
    cell.classList.toggle("blocked", blocks.has(key));
  });
}

export function clearSchedule() {
  document.querySelectorAll(".cal-cell.scheduled").forEach(c => {
    c.classList.remove("scheduled");
    c.textContent = "";
  });
}

export function renderSchedule(sections) {
  clearSchedule();
  sections.forEach(section => {
    const startSlot = timeToSlot(section.startTime);
    const endSlot   = timeToSlot(section.endTime);
    section.days.forEach(day => {
      for (let s = startSlot; s < endSlot; s++) {
        const cell = document.querySelector(
          `.cal-cell[data-day="${day}"][data-slot="${s}"]`
        );
        if (!cell) continue;
        cell.classList.add("scheduled");
        if (s === startSlot) cell.textContent = section.courseId || section.id;
      }
    });
  });
}

// --- drag-to-block ---
export function attachDragHandlers(onChange = () => {}) {
  const container = document.getElementById("calendar");
  let dragging = false;
  let mode = "add"; // "add" or "remove" — determined by first cell touched

  function cellKey(cell) {
    return blockKey(cell.dataset.day, Number(cell.dataset.slot));
  }
  function apply(cell) {
    if (!cell.classList.contains("cal-cell")) return;
    const key = cellKey(cell);
    if (mode === "add") _blocks.add(key);
    else _blocks.delete(key);
    cell.classList.toggle("blocked", _blocks.has(key));
  }

  container.addEventListener("mousedown", e => {
    const cell = e.target.closest(".cal-cell");
    if (!cell) return;
    e.preventDefault();
    dragging = true;
    mode = _blocks.has(cellKey(cell)) ? "remove" : "add";
    apply(cell);
  });
  container.addEventListener("mouseover", e => {
    if (!dragging) return;
    const cell = e.target.closest(".cal-cell");
    if (cell) apply(cell);
  });
  window.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      onChange(_blocks);
    }
  });

  // right-click to remove a single cell
  container.addEventListener("contextmenu", e => {
    const cell = e.target.closest(".cal-cell");
    if (!cell) return;
    e.preventDefault();
    const key = cellKey(cell);
    _blocks.delete(key);
    cell.classList.remove("blocked");
    onChange(_blocks);
  });
}
