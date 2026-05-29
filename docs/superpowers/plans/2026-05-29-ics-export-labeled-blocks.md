# PolyTime Stretch Goals: ICS Export + Labeled Blocks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add click-to-cycle labeled calendar blocks (Work/Gym/Sleep/Commute with distinct colors) and an "Export .ics" button that downloads the active schedule as a recurring Fall 2026 semester calendar file.

**Architecture:** Feature 2 (labeled blocks) ships first — it migrates `_blocks` from a `Set` to a `Map`, and Feature 1's export code reads from that same Map. Feature 2 touches `calendar.js` (data structure + drag UX), `styles.css` (4 label colors), and `app.js` (serialization). Feature 1 adds a new pure-function module `ics-export.js` and one button + import in `app.js`.

**Tech Stack:** Vanilla ES modules, no bundler. Jest + Babel for tests (`npm test`). CSS custom properties. `Blob` + anchor-click trick for file download. No new npm dependencies.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `styles.css` | Modify | Change base `--blocked` to gray; add 4 label color classes |
| `js/calendar.js` | Modify | `_blocks` Set→Map; `updateBlockedCell()`; `cycleLabel()`; updated drag handlers with `pendingCell`/`hasDragged` |
| `js/app.js` | Modify | Block serialization (save/load as plain object); `applyIcsEvents` Map fix; export button wiring |
| `js/ics-export.js` | Create | `generateIcs(sections)` — builds VCALENDAR string |

---

## FEATURE 2: LABELED BLOCKS

### Task 1: Add label CSS classes to `styles.css`

**Files:**
- Modify: `styles.css`

The current `.cal-cell.blocked` rule uses `background` (shorthand), which would wipe the diagonal stripe if a label class overrides it. Split it into `background-color` + `background-image` so label classes can override only the color.

Also change the base `--blocked` color from red (`#ef4444`) to neutral gray (`#4b5563`). Red becomes the gym label.

- [ ] **Step 1: Change `--blocked` variable and split the `.blocked` rule**

In `styles.css`, change line 2 from:
```css
  --blocked: #ef4444;
```
to:
```css
  --blocked: #4b5563;
```

Then replace the `.cal-cell.blocked` rule (currently uses `background` shorthand):
```css
.cal-cell.blocked {
  background: var(--blocked);
  background-image: repeating-linear-gradient(
    45deg, transparent, transparent 4px,
    rgba(0,0,0,0.12) 4px, rgba(0,0,0,0.12) 5px
  );
}
```
with (split into `background-color` + `background-image` so label subclasses can override only the color):
```css
.cal-cell.blocked {
  background-color: var(--blocked);
  background-image: repeating-linear-gradient(
    45deg, transparent, transparent 4px,
    rgba(0,0,0,0.12) 4px, rgba(0,0,0,0.12) 5px
  );
}
```

- [ ] **Step 2: Add the 4 label color classes immediately after `.cal-cell.blocked`**

```css
.cal-cell.blocked.blocked-work    { background-color: #3b82f6; }
.cal-cell.blocked.blocked-gym     { background-color: #ef4444; }
.cal-cell.blocked.blocked-sleep   { background-color: #8b5cf6; }
.cal-cell.blocked.blocked-commute { background-color: #f59e0b; }
```

- [ ] **Step 3: Run tests — expect no change to pass count**

```
cd "C:\Users\imaje\OneDrive - Cal Poly\Y2\Coding\CPVC Projects\2026-05-28-company-problem-solution"
npm test
```
Expected: `Tests: 41 passed`

- [ ] **Step 4: Commit**

```
git add styles.css
git commit -m "style: gray base blocked color, add labeled-block color classes"
```

---

### Task 2: Migrate `_blocks` Set→Map in `calendar.js`

**Files:**
- Modify: `js/calendar.js`

`_blocks` changes from `Set<string>` to `Map<string, string>` where the value is `"" | "work" | "gym" | "sleep" | "commute"`. `Map.has()` and `Map.delete()` are API-compatible with `Set` — `optimizer.js` needs no changes.

The drag handler currently calls `apply()` immediately on `mousedown` — which removes a blocked cell before `mouseup` can intercept a click. Fix: defer removal via `pendingCell`/`hasDragged` flags so a click-without-drag cycles the label instead.

- [ ] **Step 1: Change `_blocks` declaration and add label helpers after `clearBlocks`**

Find the `// --- block store ---` comment (around line 22). Replace the three lines that follow it:
```js
const _blocks = new Set();
export function getBlocks() { return _blocks; }
export function clearBlocks() { _blocks.clear(); renderBlocks(_blocks); }
```
with:
```js
const _blocks = new Map();
export function getBlocks() { return _blocks; }
export function clearBlocks() { _blocks.clear(); renderBlocks(_blocks); }

const LABEL_CLASSES = ["blocked-work", "blocked-gym", "blocked-sleep", "blocked-commute"];
const CYCLE_LABELS  = ["", "work", "gym", "sleep", "commute"];

function updateBlockedCell(cell, label) {
  // label: string (including "") = blocked; undefined = not blocked
  const isBlocked = label !== undefined;
  cell.classList.toggle("blocked", isBlocked);
  LABEL_CLASSES.forEach(cls => cell.classList.remove(cls));
  if (isBlocked && label) cell.classList.add(`blocked-${label}`);
  const day  = cell.dataset.day;
  const slot = Number(cell.dataset.slot);
  if (isBlocked) {
    cell.setAttribute("aria-pressed", "true");
    const suffix = label ? ` (${label})` : "";
    cell.setAttribute("aria-label", `${DAY_LABELS[day]} ${slotToTime(slot)}, blocked${suffix}`);
  } else if (!cell.classList.contains("scheduled")) {
    cell.setAttribute("aria-pressed", "false");
    cell.setAttribute("aria-label", `${DAY_LABELS[day]} ${slotToTime(slot)}, available`);
  }
}

function cycleLabel(cell) {
  const key  = blockKey(cell.dataset.day, Number(cell.dataset.slot));
  if (!_blocks.has(key)) return;
  const cur  = _blocks.get(key);
  const next = CYCLE_LABELS[(CYCLE_LABELS.indexOf(cur) + 1) % CYCLE_LABELS.length];
  _blocks.set(key, next);
  updateBlockedCell(cell, next);
}
```

- [ ] **Step 2: Replace `renderBlocks()` body to use `updateBlockedCell`**

Find `export function renderBlocks(blocks)` and replace its entire body:
```js
export function renderBlocks(blocks) {
  document.querySelectorAll(".cal-cell").forEach(cell => {
    const key = blockKey(cell.dataset.day, Number(cell.dataset.slot));
    updateBlockedCell(cell, blocks.get(key));
  });
}
```

- [ ] **Step 3: Replace the entire `attachDragHandlers` function**

Replace `export function attachDragHandlers(onChange = () => {}) { ... }` with:

```js
export function attachDragHandlers(onChange = () => {}) {
  const container = document.getElementById("calendar");
  let dragging    = false;
  let mode        = "add";
  let pendingCell = null;
  let hasDragged  = false;

  function cellKey(cell) {
    return blockKey(cell.dataset.day, Number(cell.dataset.slot));
  }
  function apply(cell) {
    if (!cell.classList.contains("cal-cell")) return;
    const key = cellKey(cell);
    if (mode === "add") _blocks.set(key, "");
    else _blocks.delete(key);
    updateBlockedCell(cell, _blocks.get(key));
  }

  container.addEventListener("mousedown", e => {
    const cell = e.target.closest(".cal-cell");
    if (!cell) return;
    e.preventDefault();
    dragging    = true;
    hasDragged  = false;
    if (_blocks.has(cellKey(cell))) {
      mode        = "remove";
      pendingCell = cell;   // defer — may be a click-to-cycle, not a drag-to-remove
    } else {
      mode        = "add";
      pendingCell = null;
      apply(cell);
    }
  });
  container.addEventListener("mouseover", e => {
    if (!dragging) return;
    const cell = e.target.closest(".cal-cell");
    if (!cell) return;
    if (!hasDragged) {
      hasDragged = true;
      if (pendingCell) apply(pendingCell);  // flush deferred removal now that it's a real drag
    }
    apply(cell);
  });
  window.addEventListener("mouseup", () => {
    if (dragging) {
      if (!hasDragged && pendingCell) cycleLabel(pendingCell);  // click on blocked cell
      dragging    = false;
      hasDragged  = false;
      pendingCell = null;
      onChange(_blocks);
    }
  });

  container.addEventListener("contextmenu", e => {
    const cell = e.target.closest(".cal-cell");
    if (!cell) return;
    e.preventDefault();
    const key = cellKey(cell);
    _blocks.delete(key);
    updateBlockedCell(cell, undefined);
    onChange(_blocks);
  });

  container.addEventListener("keydown", e => {
    const cell = e.target.closest(".cal-cell");
    if (!cell) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const key = cellKey(cell);
      if (_blocks.has(key)) {
        cycleLabel(cell);
      } else {
        _blocks.set(key, "");
        updateBlockedCell(cell, "");
      }
      onChange(_blocks);
    }
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const day  = cell.dataset.day;
      const slot = Number(cell.dataset.slot);
      let nextDay = day, nextSlot = slot;
      if (e.key === "ArrowUp")    nextSlot = Math.max(0, slot - 1);
      if (e.key === "ArrowDown")  nextSlot = Math.min(SLOT_COUNT - 1, slot + 1);
      if (e.key === "ArrowLeft")  { const i = DAYS.indexOf(day); if (i > 0) nextDay = DAYS[i - 1]; }
      if (e.key === "ArrowRight") { const i = DAYS.indexOf(day); if (i < DAYS.length - 1) nextDay = DAYS[i + 1]; }
      const next = container.querySelector(`.cal-cell[data-day="${nextDay}"][data-slot="${nextSlot}"]`);
      if (next) next.focus();
    }
  });
}
```

- [ ] **Step 4: Run tests**

```
npm test
```
Expected: `Tests: 41 passed`

Note: `optimizer.test.js` passes `new Set(["M:4"])` directly to `blockConflicts` — that still works because `blockConflicts` only calls `.has()`, which is identical on Set and Map.

- [ ] **Step 5: Commit**

```
git add js/calendar.js
git commit -m "feat: labeled blocks — _blocks Set→Map, click-to-cycle labels, pendingCell drag fix"
```

---

### Task 3: Update `app.js` serialization for Map blocks

**Files:**
- Modify: `js/app.js`

Three changes: (1) save blocks as a plain object instead of an array, (2) load blocks handling both old array format and new object format, (3) fix `applyIcsEvents` to use `Map.set`.

- [ ] **Step 1: Fix `saveToStorage()` — serialize Map as plain object**

Find `saveToStorage()`. Change:
```js
    blocks: [...getBlocks()],
```
to:
```js
    blocks: Object.fromEntries(getBlocks()),
```

- [ ] **Step 2: Fix block restoration in `main()` — handle both old (array) and new (object) formats**

In the `main()` async IIFE at the bottom of the file, find:
```js
    const blocks = getBlocks();
    saved.blocks.forEach(k => blocks.add(k));
```
Replace with:
```js
    const blocks = getBlocks();
    if (Array.isArray(saved.blocks)) {
      saved.blocks.forEach(k => blocks.set(k, ""));         // old format: array of key strings
    } else {
      Object.entries(saved.blocks || {}).forEach(([k, v]) => blocks.set(k, v)); // new format
    }
```

- [ ] **Step 3: Fix `applyIcsEvents()` — use `Map.set` instead of `Set.add`**

Find `applyIcsEvents()`. Change:
```js
        if (!blocks.has(key)) { blocks.add(key); addedSlots++; }
```
to:
```js
        if (!blocks.has(key)) { blocks.set(key, ""); addedSlots++; }
```

- [ ] **Step 4: Run tests**

```
npm test
```
Expected: `Tests: 41 passed`

- [ ] **Step 5: Commit**

```
git add js/app.js
git commit -m "feat: update app.js block serialization for labeled-blocks Map"
```

---

## FEATURE 1: ICS EXPORT

### Task 4: Create `js/ics-export.js`

**Files:**
- Create: `js/ics-export.js`

Cal Poly SLO Fall 2026 semester: Aug 24 – Dec 18, 2026. Aug 24 is a Monday, so the first-occurrence dates align perfectly.

- [ ] **Step 1: Create `js/ics-export.js`**

```js
const DAY_TO_BYDAY = { M: "MO", T: "TU", W: "WE", R: "TH", F: "FR" };

const FIRST_DATE = { M: "20260824", T: "20260825", W: "20260826", R: "20260827", F: "20260828" };
const UNTIL      = "20261218T235959Z";

function toIcsTime(yyyymmdd, hhmm) {
  return `${yyyymmdd}T${hhmm.replace(":", "")}00`;
}

export function generateIcs(sections) {
  const vevents = sections.map((s, i) => {
    const firstDay = s.days.reduce(
      (earliest, d) => (FIRST_DATE[d] < earliest ? FIRST_DATE[d] : earliest),
      FIRST_DATE[s.days[0]]
    );
    const byday   = s.days.map(d => DAY_TO_BYDAY[d]).join(",");
    const dtstart = toIcsTime(firstDay, s.startTime);
    const dtend   = toIcsTime(firstDay, s.endTime);
    return [
      "BEGIN:VEVENT",
      `UID:polytime-${s.courseId}-${i}@polytime`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byday};UNTIL=${UNTIL}`,
      `SUMMARY:${s.courseId} — ${s.courseName}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PolyTime//EN",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");
}
```

- [ ] **Step 2: Run tests to verify the new file doesn't break the suite**

```
npm test
```
Expected: `Tests: 41 passed`

- [ ] **Step 3: Commit**

```
git add js/ics-export.js
git commit -m "feat: add ics-export.js — generateIcs() for Fall 2026 semester"
```

---

### Task 5: Wire "Export .ics" button in `app.js`

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Add `generateIcs` import at the top of `app.js`**

After the existing `import` block (the last import line currently imports from `./optimizer.js`), add:
```js
import { generateIcs } from "./ics-export.js";
```

- [ ] **Step 2: Add the export button to `renderSummary()`**

In `renderSummary()`, find the end of the `box.innerHTML = ...` assignment. The current last line is:
```js
    .map(s => `
      <div class="course-row">
        <strong>${s.courseId} &ndash; ${s.courseName}</strong>
        <div class="meta">
          ${s.days.join("")} ${s.startTime}&ndash;${s.endTime}
          &middot; ${s.professor} (${s.rating.toFixed(1)}★)
        </div>
      </div>`).join("") + reasonsHtml;
```
Change to:
```js
    .map(s => `
      <div class="course-row">
        <strong>${s.courseId} &ndash; ${s.courseName}</strong>
        <div class="meta">
          ${s.days.join("")} ${s.startTime}&ndash;${s.endTime}
          &middot; ${s.professor} (${s.rating.toFixed(1)}★)
        </div>
      </div>`).join("") + reasonsHtml +
    `<button id="export-ics-btn" style="margin-top:10px;width:100%;">Export .ics</button>`;
```

- [ ] **Step 3: Wire the export button click handler in `renderSummary()`**

Directly after the existing `document.getElementById("next-schedule")?.addEventListener(...)` line, add:
```js
  document.getElementById("export-ics-btn")?.addEventListener("click", () => {
    const icsText = generateIcs(state.topSchedules[state.activeIdx]);
    const blob    = new Blob([icsText], { type: "text/calendar" });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement("a");
    a.href        = url;
    a.download    = "polytime-schedule.ics";
    a.click();
    URL.revokeObjectURL(url);
  });
```

- [ ] **Step 4: Run tests**

```
npm test
```
Expected: `Tests: 41 passed`

- [ ] **Step 5: Commit**

```
git add js/app.js
git commit -m "feat: add Export .ics button to schedule summary"
```

---

### Task 6: Verify in the browser

The test suite covers `optimizer.js` only (pure logic). Browser verification is required for both features.

- [ ] **Start a local server**

```
cd "C:\Users\imaje\OneDrive - Cal Poly\Y2\Coding\CPVC Projects\2026-05-28-company-problem-solution"
npx serve .
```
Open `http://localhost:3000` in a browser.

- [ ] **Verify labeled blocks**

  1. Drag across several empty cells — they should turn dark gray with the diagonal stripe.
  2. Click one blocked cell — it turns blue ("work"). Click again — red ("gym"). Click again — purple ("sleep"). Click again — amber ("commute"). Click again — back to gray ("").
  3. Right-click a blocked cell — it disappears (removed).
  4. Add a labeled block (e.g., click to "work"), then reload the page. The block should re-appear as blue (not gray). Verify in DevTools → Application → localStorage: `polytime-state.blocks` should be an object like `{"M:3": "work"}`, not an array.

- [ ] **Verify ICS export**

  1. Select some courses, click "Generate Schedule". Confirm the schedule appears.
  2. Click "Export .ics" — a file download should trigger.
  3. Open `polytime-schedule.ics` in a text editor. Verify:
     - Starts with `BEGIN:VCALENDAR`
     - Each course has a `BEGIN:VEVENT` / `END:VEVENT` block
     - `DTSTART` begins with `20260824` (or `20260825`–`20260828` depending on the day)
     - `RRULE` contains `BYDAY=` and `UNTIL=20261218T235959Z`
     - `SUMMARY` contains the course ID and name
  4. Import the `.ics` into Google Calendar or Apple Calendar — verify events appear as weekly recurring events through Dec 18.

- [ ] **Push to GitHub**

```
git push
```
