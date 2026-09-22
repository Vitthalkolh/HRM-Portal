import type { WorkingDuration } from '../api/types';

/** Parses an API date ("yyyy-MM-dd") as a local date, avoiding UTC off-by-one shifts. */
export function parseDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const today = (): string => toIsoDate(new Date());

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return parseDate(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDayMonth(value: string | null | undefined): string {
  if (!value) return '—';
  return parseDate(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "5 years, 3 months, 21 days" with pluralisation and zero parts dropped. */
export function formatDuration(duration: WorkingDuration): string {
  const parts = [
    duration.years > 0 ? `${duration.years} year${duration.years === 1 ? '' : 's'}` : null,
    duration.months > 0 ? `${duration.months} month${duration.months === 1 ? '' : 's'}` : null,
    duration.days > 0 ? `${duration.days} day${duration.days === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'Started today';
}

/** Trims trailing zeros so 5.00 reads "5" and 0.50 reads "0.5". */
export const formatDays = (days: number): string => Number(days).toString();

export const formatAmount = (amount: number): string =>
  new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Inclusive date range as ISO strings, used for calendar queries. */
export function monthRange(year: number, month: number): { start: string; end: string } {
  return {
    start: toIsoDate(new Date(year, month, 1)),
    end: toIsoDate(new Date(year, month + 1, 0)),
  };
}
