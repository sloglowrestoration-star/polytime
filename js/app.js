import {
  initCalendar, attachDragHandlers, renderBlocks, renderSchedule,
  clearSchedule, getBlocks, clearBlocks
} from "./calendar.js";
import {
  filterSections, generatePermutations, sortSchedules, detectWarnings
} from "./optimizer.js";

const state = {
  courses: [],
  selected: new Set(),
  preference: "morning"
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
  const warningHtml = warnings.length > 0
    ? `<div class="warning-box">
        ⚠ ${warnings.map(w => `<div>${w}</div>`).join("")}
       </div>`
    : "";
  box.innerHTML = warningHtml + schedule
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
  const top = sorted[0] || null;
  if (!top) {
    clearSchedule();
    renderSummary(null);
    return;
  }
  const warnings = detectWarnings(top, state.preference);
  renderSchedule(top);
  renderSummary(top, warnings);
}

function wireControls() {
  document.querySelectorAll('input[name="preference"]').forEach(r => {
    r.addEventListener("change", e => { state.preference = e.target.value; });
  });
  document.getElementById("generate-btn").addEventListener("click", onGenerate);
  document.getElementById("clear-blocks-btn").addEventListener("click", () => {
    clearBlocks();
  });
}

(async function main() {
  initCalendar();
  attachDragHandlers(blocks => renderBlocks(blocks));
  await loadCourses();
  renderCourseList();
  wireControls();
})();
