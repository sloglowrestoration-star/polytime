import { timeToSlot, blockKey } from "./calendar.js";

export function timesOverlap(a, b) {
  const sharedDay = a.days.some(d => b.days.includes(d));
  if (!sharedDay) return false;
  const aStart = timeToSlot(a.startTime);
  const aEnd   = timeToSlot(a.endTime);
  const bStart = timeToSlot(b.startTime);
  const bEnd   = timeToSlot(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

export function blockConflicts(section, blocks) {
  const start = timeToSlot(section.startTime);
  const end   = timeToSlot(section.endTime);
  for (const day of section.days) {
    for (let s = start; s < end; s++) {
      if (blocks.has(blockKey(day, s))) return true;
    }
  }
  return false;
}

export function filterSections(courses, blocks) {
  const result = [];
  for (const course of courses) {
    const surviving = course.sections.filter(sec => !blockConflicts(sec, blocks));
    if (surviving.length > 0) {
      result.push({ ...course, sections: surviving });
    }
  }
  return result;
}

export function generatePermutations(courses) {
  if (courses.length === 0) return [];
  const tagged = courses.map(c =>
    c.sections.map(s => ({ ...s, courseId: c.id, courseName: c.name,
                           professor: c.professor, rating: c.rating }))
  );
  const results = [];
  function recurse(idx, picked) {
    if (idx === tagged.length) { results.push(picked); return; }
    for (const candidate of tagged[idx]) {
      const conflict = picked.some(p => timesOverlap(p, candidate));
      if (!conflict) recurse(idx + 1, [...picked, candidate]);
    }
  }
  recurse(0, []);
  return results;
}

export function averageStartMinutes(schedule) {
  if (schedule.length === 0) return 0;
  const sum = schedule.reduce((acc, s) => {
    const [h, m] = s.startTime.split(":").map(Number);
    return acc + h * 60 + m;
  }, 0);
  return sum / schedule.length;
}

// Thresholds: night person warned about classes before 10am; morning person warned after 3pm
const NIGHT_EARLY_CUTOFF  = timeToSlot("10:00"); // slot 6
const MORNING_LATE_CUTOFF = timeToSlot("15:00"); // slot 16

export function detectWarnings(schedule, preference) {
  if (preference === "none") return [];
  const warnings = [];
  schedule.forEach(section => {
    const start = timeToSlot(section.startTime);
    if (preference === "night" && start < NIGHT_EARLY_CUTOFF) {
      warnings.push(`${section.courseId} starts at ${section.startTime} — early for a Night Person`);
    }
    if (preference === "morning" && start >= MORNING_LATE_CUTOFF) {
      warnings.push(`${section.courseId} starts at ${section.startTime} — late for a Morning Person`);
    }
  });
  return warnings;
}

export function totalGapMinutes(schedule) {
  const byDay = {};
  for (const s of schedule) {
    for (const d of s.days) {
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(s);
    }
  }
  let total = 0;
  for (const sections of Object.values(byDay)) {
    sections.sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < sections.length; i++) {
      const [eh, em] = sections[i - 1].endTime.split(":").map(Number);
      const [sh, sm] = sections[i].startTime.split(":").map(Number);
      const gap = (sh * 60 + sm) - (eh * 60 + em);
      if (gap > 0) total += gap;
    }
  }
  return total;
}

export function scoreSchedule(schedule, preference) {
  const avgRating = schedule.reduce((s, c) => s + (c.rating ?? 0), 0) / schedule.length;
  const ratingScore = avgRating / 5;

  const uniqueDays = new Set(schedule.flatMap(s => s.days)).size;
  const daysScore = (5 - uniqueDays) / 4;

  const gapMins = totalGapMinutes(schedule);
  const gapScore = Math.max(0, 1 - gapMins / 120);

  if (preference === "none") {
    return 0.40 * ratingScore + 0.30 * daysScore + 0.30 * gapScore;
  }

  const avgStart = averageStartMinutes(schedule);
  const startNorm = Math.min(1, Math.max(0, (avgStart - 8 * 60) / (12 * 60)));
  const startScore = preference === "night" ? startNorm : 1 - startNorm;

  return 0.35 * ratingScore + 0.25 * daysScore + 0.25 * gapScore + 0.15 * startScore;
}

export function diagnoseConflicts(courses) {
  const reasons = [];
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i];
      const b = courses[j];
      const allOverlap = a.sections.every(sa => b.sections.every(sb => timesOverlap(sa, sb)));
      if (allOverlap) reasons.push(`${a.id} and ${b.id} — every section overlaps`);
    }
  }
  return reasons;
}

export function sortSchedules(permutations, preference) {
  const copy = [...permutations];
  copy.sort((a, b) => scoreSchedule(b, preference) - scoreSchedule(a, preference));
  return copy;
}
