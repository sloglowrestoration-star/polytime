import {
  initCalendar, attachDragHandlers, renderBlocks, renderSchedule,
  clearSchedule, getBlocks, clearBlocks, timeToSlot, blockKey, DAYS, SLOT_COUNT
} from "./calendar.js";
import { parseIcs } from "./ics-parser.js";
import {
  filterSections, generatePermutations, sortSchedules, detectWarnings
} from "./optimizer.js";

const state = {
  courses: [],
  selected: new Set(),
  preference: "morning",
  topSchedules: [],
  activeIdx: 0
};

async function loadCourses() {
  const res = await fetch("./data/courses.json");
  state.courses = await res.json();
  state.courses.forEach(c => state.selected.add(c.id));
}

function renderCourseList() {
  const ul = document.getElementById("course-list");
  ul.innerHTML = "";
  state.courses.forEach(c => {
    const li = document.createElement("li");
    li.innerHTML = `
      <label>
        <input type="checkbox" id="course-${c.id}" checked />
        <strong>${c.id}</strong> ${c.name}
        <span style="color:var(--muted); font-size:12px;">
          (${c.professor}, ${c.rating.toFixed(1)}★)
        </span>
      </label>`;
    li.querySelector("input").addEventListener("change", e => {
      if (e.target.checked) state.selected.add(c.id);
      else state.selected.delete(c.id);
    });
    ul.appendChild(li);
  });
}

function renderSummary(schedule, warnings = []) {
  const box = document.getElementById("schedule-summary");
  if (!schedule || schedule.length === 0) {
    box.innerHTML = `<p class="empty-msg">No valid schedule found. Try removing block-outs or excluding a course.</p>`;
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
      </div>`).join("");
  document.getElementById("prev-schedule")?.addEventListener("click", () => showSchedule(state.activeIdx - 1));
  document.getElementById("next-schedule")?.addEventListener("click", () => showSchedule(state.activeIdx + 1));
}

function showSchedule(idx) {
  state.activeIdx = idx;
  const schedule = state.topSchedules[idx];
  const warnings = detectWarnings(schedule, state.preference);
  renderSchedule(schedule);
  renderSummary(schedule, warnings);
}

function onGenerate() {
  const selectedCourses = state.courses.filter(c => state.selected.has(c.id));
  if (selectedCourses.length === 0) {
    clearSchedule();
    renderSummary(null);
    return;
  }
  const filtered = filterSections(selectedCourses, getBlocks());
  if (filtered.length < selectedCourses.length) {
    clearSchedule();
    renderSummary(null);
    return;
  }
  const perms = generatePermutations(filtered);
  const sorted = sortSchedules(perms, state.preference);
  state.topSchedules = sorted.slice(0, 3);
  state.activeIdx = 0;
  if (state.topSchedules.length === 0) {
    clearSchedule();
    renderSummary(null);
    return;
  }
  showSchedule(0);
}

function applyIcsEvents(events) {
  const blocks = getBlocks();
  let addedSlots = 0;
  events.forEach(event => {
    const startSlot = timeToSlot(event.startTime);
    const endSlot   = timeToSlot(event.endTime);
    if (startSlot < 0 || endSlot > SLOT_COUNT) return; // outside calendar range
    event.days.forEach(day => {
      if (!DAYS.includes(day)) return;
      for (let s = startSlot; s < endSlot; s++) {
        const key = blockKey(day, s);
        if (!blocks.has(key)) { blocks.add(key); addedSlots++; }
      }
    });
  });
  renderBlocks(blocks);
  return addedSlots;
}

function wireControls() {
  document.querySelectorAll('input[name="preference"]').forEach(r => {
    r.addEventListener("change", e => { state.preference = e.target.value; });
  });
  document.getElementById("generate-btn").addEventListener("click", onGenerate);
  document.getElementById("clear-blocks-btn").addEventListener("click", () => {
    clearBlocks();
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
  attachDragHandlers(blocks => renderBlocks(blocks));
  await loadCourses();
  renderCourseList();
  wireControls();
})();
