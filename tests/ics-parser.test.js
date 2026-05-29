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

// UTC Z-suffix handling
test("parseIcs: Z-suffix UTC times are converted to local time", () => {
  // 2026-05-26 17:00 UTC — compute expected local time for this machine
  const ref = new Date(Date.UTC(2026, 4, 26, 17, 0));
  const expectedStart = `${String(ref.getHours()).padStart(2,"0")}:${String(ref.getMinutes()).padStart(2,"0")}`;
  const UTC_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260526T170000Z
DTEND:20260526T180000Z
SUMMARY:UTC Meeting
END:VEVENT
END:VCALENDAR`;
  const events = parseIcs(UTC_ICS);
  // Only assert if local conversion lands on a weekday (Mon-Fri)
  const localDow = ref.getDay();
  if (localDow >= 1 && localDow <= 5) {
    expect(events).toHaveLength(1);
    expect(events[0].startTime).toBe(expectedStart);
  }
});

test("parseIcs: Z-suffix does not leave the raw UTC hour as the event time", () => {
  // If the machine is not in UTC, stripping Z and treating as local gives the wrong time.
  // Verify the parser produces the same result as manually constructing a local Date from UTC.
  const ref = new Date(Date.UTC(2026, 4, 26, 3, 0)); // 03:00 UTC — differs from local in most timezones
  const expectedStart = `${String(ref.getHours()).padStart(2,"0")}:${String(ref.getMinutes()).padStart(2,"0")}`;
  const UTC_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260526T030000Z
DTEND:20260526T040000Z
SUMMARY:UTC Early
END:VEVENT
END:VCALENDAR`;
  const events = parseIcs(UTC_ICS);
  const localDow = ref.getDay();
  if (localDow >= 1 && localDow <= 5) {
    expect(events).toHaveLength(1);
    expect(events[0].startTime).toBe(expectedStart);
  }
});
