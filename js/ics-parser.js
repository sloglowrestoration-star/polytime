// Maps iCal BYDAY tokens to our day keys
const BYDAY_MAP = { MO:"M", TU:"T", WE:"W", TH:"R", FR:"F" };
// Maps JS Date.getDay() (0=Sun) to our day keys; Sat/Sun intentionally absent
const JS_DOW_MAP = { 1:"M", 2:"T", 3:"W", 4:"R", 5:"F" };

function parseRawDateTime(raw) {
  // raw examples: "20260525T090000Z", "20260525T090000", "20260525"
  // Strip TZID parameter if present (value after the colon is what we want)
  const valuePart = raw.includes(":") ? raw.split(":").pop() : raw;
  const clean = valuePart.replace(/Z$/, "");
  if (!clean.includes("T")) return null; // all-day — skip
  const datePart = clean.slice(0, 8);
  const timePart = clean.slice(9, 15);
  const year  = parseInt(datePart.slice(0, 4), 10);
  const month = parseInt(datePart.slice(4, 6), 10) - 1;
  const day   = parseInt(datePart.slice(6, 8), 10);
  const h     = timePart.slice(0, 2);
  const mi    = timePart.slice(2, 4);
  // Use local-time constructor so getDay() gives the user's calendar day
  const date = new Date(year, month, day, parseInt(h, 10), parseInt(mi, 10));
  return { date, timeStr: `${h}:${mi}` };
}

function getPropertyValue(block, key) {
  // Matches "KEY:value" and "KEY;param=x:value" — returns the value after the last colon
  const re = new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, "m");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

export function parseIcs(text) {
  const events = [];
  const veventRe = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;
  while ((match = veventRe.exec(text)) !== null) {
    const block = match[1];
    const dtstart = getPropertyValue(block, "DTSTART");
    const dtend   = getPropertyValue(block, "DTEND");
    const rrule   = getPropertyValue(block, "RRULE");
    const summary = getPropertyValue(block, "SUMMARY") || "Blocked";
    if (!dtstart || !dtend) continue;
    const start = parseRawDateTime(dtstart);
    const end   = parseRawDateTime(dtend);
    if (!start || !end) continue; // all-day event

    let days = [];
    if (rrule) {
      const bydayMatch = rrule.match(/BYDAY=([^;]+)/);
      if (bydayMatch) {
        days = bydayMatch[1]
          .split(",")
          .map(token => BYDAY_MAP[token.replace(/[+\-\d]/g, "")])
          .filter(Boolean);
      }
    }
    // Fall back to the DTSTART day of week for one-off events
    if (days.length === 0) {
      const mapped = JS_DOW_MAP[start.date.getDay()];
      if (mapped) days = [mapped];
    }
    if (days.length === 0) continue; // weekend — skip

    events.push({ days, startTime: start.timeStr, endTime: end.timeStr, summary });
  }
  return events;
}
