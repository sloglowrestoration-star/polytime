# PolyTime Stretch Goals: ICS Export + Labeled Blocks

**Date:** 2026-05-29  
**Status:** Approved  
**Scope:** Two independent stretch goal features for the PolyTime schedule optimizer.

---

## Feature 1: ICS Export

### Goal
Let users download their chosen schedule as a `.ics` file that opens directly in Google Calendar, Apple Calendar, or Outlook as a recurring Fall 2026 course schedule.

### New Module: `js/ics-export.js`

Exports one function:

```js
export function generateIcs(sections) → string
```

`sections` is `topSchedules[activeIdx]` — an array of objects with `{days, startTime, endTime, courseId, courseName}`.

Each section becomes one `VEVENT` with a weekly `RRULE`. A section meeting on multiple days (e.g. M/W/F) is represented as a single event with `RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR`, not three separate events.

### Quarter Dates

Fall 2026 Cal Poly quarter: **Sept 22 – Dec 12, 2026**.

First-occurrence dates by day key:
| Day key | Date       |
|---------|------------|
| M       | 2026-09-22 |
| T       | 2026-09-23 |
| W       | 2026-09-24 |
| R       | 2026-09-25 |
| F       | 2026-09-26 |

`DTSTART` uses the earliest matching day in the quarter. `RRULE UNTIL` is `20261212T235959Z`.

### ICS Format

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PolyTime//EN
BEGIN:VEVENT
UID:polytime-{courseId}-{firstDay}@polytime
DTSTART:{yyyymmdd}T{hhmmss}
DTEND:{yyyymmdd}T{hhmmss}
RRULE:FREQ=WEEKLY;BYDAY={MO,WE,FR};UNTIL=20261212T235959Z
SUMMARY:{courseId} — {courseName}
END:VEVENT
...
END:VCALENDAR
```

Times are local (no `Z` suffix), consistent with what the existing `ics-parser.js` produces on import.

Day key → iCal BYDAY token map: `M→MO, T→TU, W→WE, R→TH, F→FR`.

### UI Change in `app.js`

`renderSummary()` appends an **"Export .ics"** button below the course list rows. The handler:
1. Calls `generateIcs(topSchedules[activeIdx])`
2. Creates a `Blob` with type `text/calendar`
3. Creates a temporary `<a>` with `download="polytime-schedule.ics"`, clicks it, removes it

Button only rendered when `topSchedules.length > 0`. No changes to optimizer, calendar, or tests.

---

## Feature 2: Labeled Blocks

### Goal
Users can label calendar blocks (Work / Gym / Sleep / Commute) by clicking an already-blocked cell to cycle through labels. Each label gets a distinct color so the schedule grid shows what time is taken and why.

### Data Structure Change in `calendar.js`

`_blocks` changes from `Set<string>` to `Map<string, string>`:

```
key: "day:slot"  (e.g. "M:5")
value: "" | "work" | "gym" | "sleep" | "commute"
```

`Map.has()` and `Map.delete()` are API-compatible with `Set` — **`optimizer.js` needs no changes** (`blockConflicts()` only calls `blocks.has(key)`).

### Drag Handler Changes

**Problem:** Current `mousedown` on a blocked cell immediately calls `apply()` (removes the block), making it impossible to intercept a click at `mouseup`.

**Fix:** Introduce `pendingCell` and `hasDragged` flags:

| Event | Blocked cell | Empty cell |
|-------|-------------|------------|
| `mousedown` | Record `pendingCell`, set `mode="remove"`, do NOT apply yet | Apply immediately (add), `pendingCell = null` |
| `mouseover` | Set `hasDragged=true`, flush pending removal, apply each entered cell | Apply each entered cell |
| `mouseup` (no drag) | Call `cycleLabel(pendingCell)` | n/a |
| `mouseup` (after drag) | `onChange(_blocks)` as before | `onChange(_blocks)` as before |

### `cycleLabel(cell)` 

Cycles label on the Map for that cell's key:

```
"" → "work" → "gym" → "sleep" → "commute" → ""
```

Updates the Map value and swaps the label CSS class on the cell.

### CSS Classes and Colors

`.blocked` base class remains (existing dark gray `#4b5563`). Label modifier classes added:

| Label     | Class             | Color   | Hex       |
|-----------|-------------------|---------|-----------|
| (none)    | `.blocked`        | Gray    | `#4b5563` |
| work      | `.blocked-work`   | Blue    | `#3b82f6` |
| gym       | `.blocked-gym`    | Red     | `#ef4444` |
| sleep     | `.blocked-sleep`  | Purple  | `#8b5cf6` |
| commute   | `.blocked-commute`| Amber   | `#f59e0b` |

`renderBlocks()` already iterates all cells — it gains logic to add/remove label classes alongside the existing `.blocked` toggle.

### `localStorage` Changes in `app.js`

**Save:** `blocks: Object.fromEntries(getBlocks())`  
→ `{ "M:3": "work", "T:5": "", "W:12": "gym" }`

**Load:** `new Map(Object.entries(saved.blocks || {}))`  
App.js hydrates the Map by calling `getBlocks()` (returns the module-level Map reference) and mutating it directly — same pattern used today with the Set.

---

## Implementation Order

Build Feature 2 (labeled blocks) first: it changes the `_blocks` data structure that Feature 1's export button sits alongside. Doing blocks first means ICS export is written against the final state of `getBlocks()`.

1. Labeled blocks (`calendar.js`, `styles.css`, `app.js` serialization)
2. ICS export (`ics-export.js`, `app.js` button + handler)

---

## What's Not In Scope

- Custom user-defined labels (YAGNI)
- Exporting blocks as ICS busy events
- Quarter date picker UI (hardcoded Fall 2026)
- Tests for `generateIcs` (pure string transform, no branching logic)
