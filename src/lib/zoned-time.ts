/**
 * Dates typed into a form mean the organisation's own clock, not the
 * server's. These turn "2026-10-12T08:00" in Africa/Gaborone into the
 * right instant, and back.
 */

function offsetMs(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** A datetime-local value in this time zone, as an instant. Null when empty or not a date. */
export function fromLocalInput(value: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const first = guess - offsetMs(new Date(guess), timeZone);
  // Near a clock change the offset can differ at the answer; check once more.
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** An instant as a datetime-local value in this time zone. */
export function toLocalInput(at: Date | null | undefined, timeZone: string): string {
  if (!at) return "";
  const local = new Date(at.getTime() + offsetMs(at, timeZone));
  return local.toISOString().slice(0, 16);
}
