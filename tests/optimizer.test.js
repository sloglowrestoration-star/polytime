import {
  timesOverlap, blockConflicts, filterSections,
  generatePermutations, sortSchedules, detectWarnings
} from "../js/optimizer.js";

const A = { id:"A1", days:["M","W"], startTime:"09:00", endTime:"10:00" };
const B = { id:"B1", days:["M"],     startTime:"09:30", endTime:"10:30" };
const C = { id:"C1", days:["T"],     startTime:"09:00", endTime:"10:00" };
const D = { id:"D1", days:["W"],     startTime:"10:00", endTime:"11:00" };

test("timesOverlap: same day overlapping windows -> true", () => {
  expect(timesOverlap(A, B)).toBe(true);
});
test("timesOverlap: different days -> false", () => {
  expect(timesOverlap(A, C)).toBe(false);
});
test("timesOverlap: same day, back-to-back (touching) -> false", () => {
  expect(timesOverlap(A, D)).toBe(false);
});

test("blockConflicts: section overlapping a blocked slot -> true", () => {
  const blocks = new Set(["M:4"]); // slot 4 = 09:00, inside A (09:00-10:00)
  expect(blockConflicts(A, blocks)).toBe(true);
});
test("blockConflicts: section in unblocked window -> false", () => {
  const blocks = new Set(["F:0"]);
  expect(blockConflicts(A, blocks)).toBe(false);
});

test("filterSections drops conflicting sections, keeps courses with survivors", () => {
  const courses = [
    { id:"X", name:"X", sections:[A, C] },
    { id:"Y", name:"Y", sections:[B] }
  ];
  // slot 5 = 09:30; falls inside A (slots 4-5) and B's start (slot 5)
  const blocks = new Set(["M:5"]);
  const out = filterSections(courses, blocks);
  expect(out).toEqual([{ id:"X", name:"X", sections:[C] }]);
});

test("generatePermutations returns cartesian product minus internal conflicts", () => {
  const courses = [
    { id:"X", name:"X", sections:[A, C] },
    { id:"Y", name:"Y", sections:[D] }
  ];
  const perms = generatePermutations(courses);
  // A vs D: A is M+W 09-10, D is W 10-11 -> touching, no overlap -> kept
  // C vs D: C is T 09-10, D is W 10-11 -> no overlap -> kept
  expect(perms).toHaveLength(2);
});

test("generatePermutations excludes internally conflicting combos", () => {
  const courses = [
    { id:"X", name:"X", sections:[A] },
    { id:"Y", name:"Y", sections:[B] } // overlaps A on M
  ];
  expect(generatePermutations(courses)).toHaveLength(0);
});

test("sortSchedules morning: earliest avg start first", () => {
  const early = [{ days:["M"], startTime:"08:00", endTime:"09:00" }];
  const late  = [{ days:["M"], startTime:"15:00", endTime:"16:00" }];
  const sorted = sortSchedules([late, early], "morning");
  expect(sorted[0]).toBe(early);
});
test("sortSchedules night: latest avg start first", () => {
  const early = [{ days:["M"], startTime:"08:00", endTime:"09:00" }];
  const late  = [{ days:["M"], startTime:"15:00", endTime:"16:00" }];
  const sorted = sortSchedules([early, late], "night");
  expect(sorted[0]).toBe(late);
});

// detectWarnings
test("detectWarnings: night person with early class gets a warning", () => {
  const schedule = [
    { courseId:"CPE357", startTime:"08:10", endTime:"09:00", days:["M","W","F"] },
    { courseId:"BUS346", startTime:"12:10", endTime:"13:30", days:["T","R"] }
  ];
  const warnings = detectWarnings(schedule, "night");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatch(/CPE357/);
  expect(warnings[0]).toMatch(/08:10/);
});
test("detectWarnings: night person with all-late classes gets no warning", () => {
  const schedule = [
    { courseId:"MATH142", startTime:"11:10", endTime:"12:00", days:["M","W","F"] },
    { courseId:"CHEM124", startTime:"17:10", endTime:"18:30", days:["T","R"] }
  ];
  expect(detectWarnings(schedule, "night")).toHaveLength(0);
});
test("detectWarnings: morning person with late class gets a warning", () => {
  const schedule = [
    { courseId:"BUS212", startTime:"16:10", endTime:"17:30", days:["M","W"] },
    { courseId:"PSY201", startTime:"09:10", endTime:"10:00", days:["T","R"] }
  ];
  const warnings = detectWarnings(schedule, "morning");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatch(/BUS212/);
  expect(warnings[0]).toMatch(/16:10/);
});
test("detectWarnings: morning person with all-early classes gets no warning", () => {
  const schedule = [
    { courseId:"CSC225", startTime:"09:10", endTime:"10:00", days:["M","W","F"] },
    { courseId:"ENGL134", startTime:"08:10", endTime:"09:30", days:["T","R"] }
  ];
  expect(detectWarnings(schedule, "morning")).toHaveLength(0);
});
