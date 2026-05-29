import {
  timesOverlap, blockConflicts, filterSections,
  generatePermutations, sortSchedules, detectWarnings,
  totalGapMinutes, scoreSchedule, diagnoseConflicts
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

// totalGapMinutes
test("totalGapMinutes: back-to-back classes on same day -> 0", () => {
  const schedule = [
    { days:["M"], startTime:"09:00", endTime:"10:00" },
    { days:["M"], startTime:"10:00", endTime:"11:00" }
  ];
  expect(totalGapMinutes(schedule)).toBe(0);
});
test("totalGapMinutes: 90-min gap on one day -> 90", () => {
  const schedule = [
    { days:["M"], startTime:"09:00", endTime:"10:00" },
    { days:["M"], startTime:"11:30", endTime:"12:30" }
  ];
  expect(totalGapMinutes(schedule)).toBe(90);
});
test("totalGapMinutes: classes on different days have no gap between them", () => {
  const schedule = [
    { days:["M","W"], startTime:"09:00", endTime:"10:00" },
    { days:["T","R"], startTime:"14:00", endTime:"15:00" }
  ];
  expect(totalGapMinutes(schedule)).toBe(0);
});
test("totalGapMinutes: gaps on multiple days are summed", () => {
  const schedule = [
    { days:["M","W"], startTime:"09:00", endTime:"10:00" },
    { days:["M","W"], startTime:"11:00", endTime:"12:00" }
  ];
  // 60-min gap on M + 60-min gap on W = 120
  expect(totalGapMinutes(schedule)).toBe(120);
});

// scoreSchedule
test("scoreSchedule: higher-rated professor wins when all else equal", () => {
  const lowRating  = [{ days:["M"], startTime:"10:00", endTime:"11:00", rating: 2 }];
  const highRating = [{ days:["M"], startTime:"10:00", endTime:"11:00", rating: 5 }];
  expect(scoreSchedule(highRating, "morning")).toBeGreaterThan(scoreSchedule(lowRating, "morning"));
});
test("scoreSchedule: fewer days on campus wins when rating and gaps are equal", () => {
  const twoDays  = [{ days:["M","W"], startTime:"10:00", endTime:"11:00", rating: 4 }];
  const fourDays = [
    { days:["M"],   startTime:"10:00", endTime:"11:00", rating: 4 },
    { days:["T"],   startTime:"10:00", endTime:"11:00", rating: 4 },
    { days:["W"],   startTime:"10:00", endTime:"11:00", rating: 4 },
    { days:["R"],   startTime:"10:00", endTime:"11:00", rating: 4 }
  ];
  expect(scoreSchedule(twoDays, "morning")).toBeGreaterThan(scoreSchedule(fourDays, "morning"));
});
test("scoreSchedule: no-gap schedule beats gappy schedule when rating/days equal", () => {
  const noGap   = [
    { days:["M"], startTime:"09:00", endTime:"10:00", rating: 4 },
    { days:["M"], startTime:"10:00", endTime:"11:00", rating: 4 }
  ];
  const bigGap  = [
    { days:["M"], startTime:"09:00", endTime:"10:00", rating: 4 },
    { days:["M"], startTime:"12:00", endTime:"13:00", rating: 4 }
  ];
  expect(scoreSchedule(noGap, "morning")).toBeGreaterThan(scoreSchedule(bigGap, "morning"));
});

// diagnoseConflicts
test("diagnoseConflicts: returns empty array when no guaranteed conflicts", () => {
  const courses = [
    { id:"X", sections:[{ days:["M"], startTime:"09:00", endTime:"10:00" }] },
    { id:"Y", sections:[{ days:["T"], startTime:"09:00", endTime:"10:00" }] }
  ];
  expect(diagnoseConflicts(courses)).toHaveLength(0);
});
test("diagnoseConflicts: identifies a pair where all sections overlap", () => {
  // Both courses have exactly one section and they share a day + time
  const courses = [
    { id:"CSC225", sections:[{ days:["M","W","F"], startTime:"09:00", endTime:"10:00" }] },
    { id:"CPE357", sections:[{ days:["M","W","F"], startTime:"09:00", endTime:"10:00" }] }
  ];
  const result = diagnoseConflicts(courses);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatch(/CSC225/);
  expect(result[0]).toMatch(/CPE357/);
});
test("diagnoseConflicts: does not flag a pair where at least one section combo is clear", () => {
  const courses = [
    { id:"X", sections:[
      { days:["M"], startTime:"09:00", endTime:"10:00" },
      { days:["T"], startTime:"14:00", endTime:"15:00" }  // no overlap with Y
    ]},
    { id:"Y", sections:[{ days:["M"], startTime:"09:00", endTime:"10:00" }] }
  ];
  expect(diagnoseConflicts(courses)).toHaveLength(0);
});
