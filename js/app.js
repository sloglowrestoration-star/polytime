import {
  initCalendar, attachDragHandlers, renderBlocks, renderSchedule,
  clearSchedule, getBlocks, clearBlocks, timeToSlot, blockKey, DAYS, SLOT_COUNT
} from "./calendar.js";
import { parseIcs } from "./ics-parser.js";
import {
  applyFilters, filterSections, generatePermutations, sortSchedules,
  detectWarnings, diagnoseConflicts, explainSchedule
} from "./optimizer.js";

const state = {
  courses: [],
  selected: new Set(),
  preference: "none",
  topSchedules: [],
  activeIdx: 0,
  filters: { noFriday: false, maxDays: null, avoidAfter: null }
};

const STORAGE_KEY = "polytime-state";

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    selected: [...state.selected],
    preference: state.preference,
    blocks: Object.fromEntries(getBlocks()),
    filters: state.filters
  }));
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function loadCourses() {
  const res = await fetch("./data/courses.json");
  state.courses = await res.json();
  state.courses.forEach(c => state.selected.add(c.id));
}

function renderCourseList() {
  const ul = document.getElementById("course-list");
  ul.innerHTML = "";
  const sorted = [...state.courses].sort((a, b) => a.id.localeCompare(b.id));
  sorted.forEach(c => {
    const li = document.createElement("li");
    li.innerHTML = `
      <label>
        <input type="checkbox" id="course-${c.id}" ${state.selected.has(c.id) ? "checked" : ""} />
        <strong>${c.id}</strong> ${c.name}
        <span style="color:var(--muted); font-size:12px;">
          (${c.professor}, ${c.rating.toFixed(1)}★)
        </span>
      </label>`;
    li.querySelector("input").addEventListener("change", e => {
      if (e.target.checked) state.selected.add(c.id);
      else state.selected.delete(c.id);
      saveToStorage();
    });
    ul.appendChild(li);
  });
}

function renderSummary(schedule, warnings = [], failMsg = null, reasons = []) {
  const box = document.getElementById("schedule-summary");
  if (!schedule || schedule.length === 0) {
    box.innerHTML = `<p class="empty-msg">${failMsg ?? "No valid schedule found. Try removing block-outs or excluding a course."}</p>`;
    return;
  }
  const navHtml = state.topSchedules.length > 1
    ? `<div class="schedule-nav">
        <button id="prev-schedule" ${state.activeIdx === 0 ? "disabled" : ""}>&#9664;</button>
        <span>Schedule ${state.activeIdx + 1} of ${state.topSchedules.length}</span>
        <button id="next-schedule" ${state.activeIdx === state.topSchedules.length - 1 ? "disabled" : ""}>&#9654;</button>
       </div>`
    : "";
  const warningHtml = warnings.length > 0
    ? `<div class="warning-box">
        ⚠ ${warnings.map(w => `<div>${w}</div>`).join("")}
       </div>`
    : "";
  const reasonsHtml = reasons.length > 0
    ? `<details class="why-box">
        <summary>Why this schedule?</summary>
        <ul>${reasons.map(r => `<li>${r}</li>`).join("")}</ul>
       </details>`
    : "";
  box.innerHTML = navHtml + warningHtml + schedule
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map(s => `
      <div class="course-row">
        <strong>${s.courseId} &ndash; ${s.courseName}</strong>
        <div class="meta">
          ${s.days.join("")} ${s.startTime}&ndash;${s.endTime}
          &middot; ${s.professor} (${s.rating.toFixed(1)}★)
        </div>
      </div>`).join("") + reasonsHtml;
  document.getElementById("prev-schedule")?.addEventListener("click", () => showSchedule(state.activeIdx - 1));
  document.getElementById("next-schedule")?.addEventListener("click", () => showSchedule(state.activeIdx + 1));
}

function showSchedule(idx) {
  state.activeIdx = idx;
  const schedule = state.topSchedules[idx];
  const warnings = detectWarnings(schedule, state.preference);
  const reasons  = explainSchedule(schedule, state.preference);
  renderSchedule(schedule);
  renderSummary(schedule, warnings, null, reasons);
}

function onGenerate() {
  const selectedCourses = state.courses.filter(c => state.selected.has(c.id));
  if (selectedCourses.length === 0) {
    clearSchedule();
    renderSummary(null);
    return;
  }
  const afterBlocks = filterSections(selectedCourses, getBlocks());
  if (afterBlocks.length < selectedCourses.length) {
    const blockedOut = selectedCourses
      .filter(c => !afterBlocks.some(f => f.id === c.id))
      .map(c => c.id);
    clearSchedule();
    renderSummary(null, [], `All sections of ${blockedOut.join(", ")} overlap with your block-outs. Clear some blocks or deselect the course.`);
    return;
  }
  const filtered = applyFilters(afterBlocks, state.filters);
  if (filtered.length < afterBlocks.length) {
    const filteredOut = afterBlocks
      .filter(c => !filtered.some(f => f.id === c.id))
      .map(c => c.id);
    clearSchedule();
    renderSummary(null, [], `No sections of ${filteredOut.join(", ")} match your current filters. Try relaxing a filter.`);
    return;
  }
  let perms = generatePermutations(filtered);
  if (state.filters.maxDays) {
    perms = perms.filter(sched => new Set(sched.flatMap(s => s.days)).size <= state.filters.maxDays);
  }
  const sorted = sortSchedules(perms, state.preference);
  state.topSchedules = sorted.slice(0, 3);
  state.activeIdx = 0;
  if (state.topSchedules.length === 0) {
    const conflicts = diagnoseConflicts(filtered);
    const failMsg = conflicts.length > 0
      ? `No valid schedule found. These courses conflict on all sections: ${conflicts.join("; ")}.`
      : `No valid schedule found — too many courses overlap. Try deselecting one.`;
    clearSchedule();
    renderSummary(null, [], failMsg);
    return;
  }
  showSchedule(0);
}

function applyIcsEvents(events) {
  const blocks = getBlocks();
  let addedSlots = 0;
  events.forEach(event => {
    const clippedStart = Math.max(0, timeToSlot(event.startTime));
    const clippedEnd   = Math.min(SLOT_COUNT, timeToSlot(event.endTime));
    if (clippedStart >= clippedEnd) return; // fully outside calendar range
    event.days.forEach(day => {
      if (!DAYS.includes(day)) return;
      for (let s = clippedStart; s < clippedEnd; s++) {
        const key = blockKey(day, s);
        if (!blocks.has(key)) { blocks.set(key, ""); addedSlots++; }
      }
    });
  });
  renderBlocks(blocks);
  return addedSlots;
}

function wireControls() {
  document.querySelectorAll('input[name="preference"]').forEach(r => {
    r.addEventListener("change", e => { state.preference = e.target.value; saveToStorage(); });
  });
  document.getElementById("filter-no-friday").addEventListener("change", e => {
    state.filters.noFriday = e.target.checked;
    saveToStorage();
  });
  document.getElementById("filter-max-days").addEventListener("change", e => {
    state.filters.maxDays = e.target.value ? Number(e.target.value) : null;
    saveToStorage();
  });
  document.getElementById("filter-avoid-after").addEventListener("change", e => {
    state.filters.avoidAfter = e.target.value || null;
    saveToStorage();
  });
  document.getElementById("generate-btn").addEventListener("click", onGenerate);
  document.getElementById("clear-blocks-btn").addEventListener("click", () => {
    clearBlocks();
    saveToStorage();
  });

  document.getElementById("ics-input").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const status = document.getElementById("ics-status");
    const reader = new FileReader();
    reader.onload = ev => {
      const events = parseIcs(ev.target.result);
      if (events.length === 0) {
        status.textContent = "No weekday events found in file.";
        status.className = "ics-status ics-warn";
        return;
      }
      const slots = applyIcsEvents(events);
      status.textContent = `Imported ${events.length} event${events.length !== 1 ? "s" : ""} (${slots} slots blocked).`;
      status.className = "ics-status ics-ok";
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported after Clear Blocks
    e.target.value = "";
  });
}

(async function main() {
  initCalendar();
  attachDragHandlers(blocks => { renderBlocks(blocks); saveToStorage(); });
  await loadCourses();

  const saved = loadFromStorage();
  if (saved) {
    state.selected = new Set(saved.selected.filter(id => state.courses.some(c => c.id === id)));
    state.preference = saved.preference ?? "none";
    const blocks = getBlocks();
    if (Array.isArray(saved.blocks)) {
      saved.blocks.forEach(k => blocks.set(k, ""));         // old format: array of key strings
    } else {
      Object.entries(saved.blocks || {}).forEach(([k, v]) => blocks.set(k, v)); // new format
    }
    renderBlocks(blocks);
    const radio = document.querySelector(`input[name="preference"][value="${state.preference}"]`);
    if (radio) radio.checked = true;
    if (saved.filters) {
      state.filters = { ...state.filters, ...saved.filters };
      if (state.filters.noFriday) document.getElementById("filter-no-friday").checked = true;
      if (state.filters.maxDays)  document.getElementById("filter-max-days").value = state.filters.maxDays;
      if (state.filters.avoidAfter) document.getElementById("filter-avoid-after").value = state.filters.avoidAfter;
    }
  }

  renderCourseList();
  wireControls();
})();
