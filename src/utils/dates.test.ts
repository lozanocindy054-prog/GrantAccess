import { describe, expect, it } from 'vitest';
import { parseDate } from './dates';

describe('parseDate', () => {
  it('accepts Firestore timestamps and serialized timestamps', () => {
    const date = new Date('2026-11-11T00:00:00Z');
    expect(parseDate({ toDate: () => date })).toEqual(date);
    expect(parseDate({ seconds: date.getTime() / 1000 })).toEqual(date);
  });
  it('accepts date strings and epoch milliseconds, including zero', () => {
    expect(parseDate(0)).toEqual(new Date(0));
    expect(parseDate('2026-11-11')).toEqual(new Date('2026-11-11'));
  });
  it('rejects missing, invalid, and unsupported values', () => {
    for (const value of [null, undefined, '', 'invalid', {}, new Date(NaN)]) {
      expect(parseDate(value)).toBeNull();
    }
  });
});
