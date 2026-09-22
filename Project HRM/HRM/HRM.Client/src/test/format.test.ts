import { describe, expect, it } from 'vitest';
import { formatDays, formatDuration, initials, monthRange, parseDate, toIsoDate } from '../utils/format';

describe('date helpers', () => {
  it('parses an API date as a local date without shifting the day', () => {
    const parsed = parseDate('2026-11-02');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(10);
    expect(parsed.getDate()).toBe(2);
  });

  it('round-trips a date through the ISO helper', () => {
    expect(toIsoDate(parseDate('2026-01-09'))).toBe('2026-01-09');
  });

  it('builds an inclusive month range', () => {
    expect(monthRange(2026, 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthRange(2024, 1).end).toBe('2024-02-29');
  });
});

describe('formatting', () => {
  it('trims trailing zeros from day counts', () => {
    expect(formatDays(5)).toBe('5');
    expect(formatDays(0.5)).toBe('0.5');
  });

  it('describes a working duration and pluralises correctly', () => {
    expect(formatDuration({ years: 5, months: 3, days: 21, totalCalendarDays: 0, totalWorkingDays: 0 }))
      .toBe('5 years, 3 months, 21 days');
    expect(formatDuration({ years: 1, months: 1, days: 1, totalCalendarDays: 0, totalWorkingDays: 0 }))
      .toBe('1 year, 1 month, 1 day');
    expect(formatDuration({ years: 0, months: 0, days: 0, totalCalendarDays: 1, totalWorkingDays: 1 }))
      .toBe('Started today');
  });

  it('builds initials from a name', () => {
    expect(initials('Priya Sharma')).toBe('PS');
    expect(initials('Madonna')).toBe('M');
    expect(initials('')).toBe('');
  });
});
