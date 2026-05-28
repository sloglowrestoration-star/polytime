import { parseIcs } from "../js/ics-parser.js";

const RECURRING_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=America/Los_Angeles:20260525T090000
DTEND;TZID=America/Los_Angeles:20260525T110000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR
SUMMARY:Work
END:VEVENT
END:VCALENDAR`;

// 2026-05-26 is a Tuesday
const ONEOFF_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260526T140000
DTEND:20260526T150000
SUMMARY:Doctor
END:VEVENT
END:VCALENDAR`;

const ALLDAY_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260525
DTEND:20260526
SUMMARY:Holiday
END:VEVENT
END:VCALENDAR`;

const WEEKEND_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260523T100000
DTEND:20260523T110000
SUMMARY:Weekend event
END:VEVENT
END:VCALENDAR`;

const MULTI_EVENT_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=America/Los_Angeles:20260525T080000
DTEND;TZID=America/Los_Angeles:20260525T090000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR
SUMMARY:Gym
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=America/Los_Angeles:20260526T170000
DTEND;TZID=America/Los_Angeles:20260526T190000
RRULE:FREQ=WEEKLY;BYDAY=TU,TH
SUMMARY:Work
END:VEVENT
END:VCALENDAR`;

test("parseIcs: recurring weekly event gets correct days and times", () => {
  const events = parseIcs(RECURRING_ICS);
  expect(events).toHaveLength(1);
  expect(events[0].days).toEqual(["M","W","F"]);
  expect(events[0].startTime).toBe("09:00");
  expect(events[0].endTime).toBe("11:00");
  expect(events[0].summary).toBe("Work");
});

test("parseIcs: one-off event maps DTSTART to day of week", () => {
  const events = parseIcs(ONEOFF_ICS);
  expect(events).toHaveLength(1);
  expect(events[0].days).toEqual(["T"]); // Tuesday
  expect(events[0].startTime).toBe("14:00");
  expect(events[0].endTime).toBe("15:00");
});

test("parseIcs: all-day events (no time) are skipped", () => {
  expect(parseIcs(ALLDAY_ICS)).toHaveLength(0);
});

test("parseIcs: weekend events are skipped", () => {
  // 2026-05-23 is a Saturday
  expect(parseIcs(WEEKEND_ICS)).toHaveLength(0);
});

test("parseIcs: multiple events in one file", () => {
  const events = parseIcs(MULTI_EVENT_ICS);
  expect(events).toHaveLength(2);
  expect(events[0].days).toEqual(["M","W","F"]);
  expect(events[1].days).toEqual(["T","R"]);
});
