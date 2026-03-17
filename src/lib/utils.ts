export class AppError extends Error {
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

export class NetworkError extends AppError {
  constructor(message = 'Błąd sieci') {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
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

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime}–${endTime}`;
}

export function formatPrice(amount: number | null, currency: string): string {
  if (amount === null) return '';
  if (amount === 0) return '';
  return `${amount} ${currency}`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
