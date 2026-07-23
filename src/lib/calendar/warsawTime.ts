// Event times arrive as Warsaw local wall-clock strings with no timezone.
// Calendars need an absolute instant, so this converts one into UTC. The offset
// is derived from the platform's own IANA data via Intl rather than a hardcoded
// DST table — no extra dependency, and it keeps working when the rules change.

const WARSAW_TZ = 'Europe/Warsaw';

/** Minutes that Europe/Warsaw is ahead of UTC at the given instant. */
function warsawOffsetMinutes(instant: Date): number {
  // Render the instant as Warsaw wall-clock, then read those numbers back as if
  // they were UTC. The gap between the two is the offset.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WARSAW_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second')
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * Convert a Warsaw wall-clock date + time into the matching UTC instant.
 *
 * @param date `YYYY-MM-DD`
 * @param time `HH:MM`
 *
 * On the two DST switch days the offset differs across the day, so the first
 * guess is re-checked against the instant it produced. In the hour that repeats
 * during the autumn transition, the re-check always converges on the later,
 * winter-time reading because Warsaw's offset is always positive; this
 * side-effect is acceptable, since a one-hour wall-clock ambiguity is
 * inherent to any local-time representation and the caller's contract is to
 * pick one — the choice itself is less important than being consistent.
 * A time inside the spring gap (02:00–02:59) would shift forward past the
 * jump, though scrapers should never produce one.
 */
export function warsawToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const naive = Date.UTC(year, month - 1, day, hours, minutes);

  const firstGuess = warsawOffsetMinutes(new Date(naive));
  const candidate = naive - firstGuess * 60_000;
  const confirmed = warsawOffsetMinutes(new Date(candidate));

  return new Date(confirmed === firstGuess ? candidate : naive - confirmed * 60_000);
}

/** Midnight UTC on the given calendar date, optionally offset by whole days. */
export function utcMidnight(date: string, addDays = 0): Date {
  const [year, month, day] = date.split('-').map(Number);
  // Day overflow is intentional — Date.UTC normalizes overflow days into the next month.
  return new Date(Date.UTC(year, month - 1, day + addDays));
}

/** Shift a `YYYY-MM-DD` string by whole days, returning the same format. */
export function shiftDateString(date: string, days: number): string {
  return utcMidnight(date, days).toISOString().slice(0, 10);
}
