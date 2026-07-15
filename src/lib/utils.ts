class AppError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Nie znaleziono') {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ServerError extends AppError {
  constructor(message = 'Błąd serwera') {
    super(message, 'SERVER_ERROR');
    this.name = 'ServerError';
  }
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pl-PL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDate().toString();
}

export function formatMonth(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pl-PL', { month: 'short' }).toUpperCase();
}

// Renders an event's time. Prefers explicit end_time, falls back to a
// synthesized end derived from duration_min, otherwise just shows the start.
export function formatEventTime(
  startTime: string,
  endTime: string,
  durationMin: number | null
): string {
  if (!startTime) return '';
  if (endTime) return `${startTime}–${endTime}`;
  if (durationMin && durationMin > 0) {
    const synthesized = addMinutes(startTime, durationMin);
    if (synthesized) return `${startTime}–${synthesized}`;
  }
  return startTime;
}

function addMinutes(hhmm: string, minutes: number): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const total = Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10) + minutes;
  if (Number.isNaN(total)) return null;
  // Wrap past midnight just in case (some studios list 23:30 + 60 min classes).
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function getCategoryIconPath(category: string): string {
  const name = category || 'inne';
  return `/category-icons/${slugify(name)}.svg`;
}
