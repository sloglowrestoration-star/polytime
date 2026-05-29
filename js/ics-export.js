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
