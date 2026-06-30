import { describe, expect, it } from 'vitest';
import { DateNormalizer } from '../../src/normalizers/date/date.normalizer';

describe('DateNormalizer', () => {
  it('normalizes month names', () => {
    const normalizer = new DateNormalizer();
    const result = normalizer.normalize('January 2024', {
      field: 'experience.startDate',
      timestamp: '2026-06-30T00:00:00.000Z',
    });

    expect(result.value).toBe('2024-01');
  });

  it('normalizes MM/YYYY values', () => {
    const normalizer = new DateNormalizer();
    const result = normalizer.normalize('01/2024', {
      field: 'education.startDate',
      timestamp: '2026-06-30T00:00:00.000Z',
    });

    expect(result.value).toBe('2024-01');
  });

  it('normalizes bare years to year-month values', () => {
    const normalizer = new DateNormalizer();
    const result = normalizer.normalize('2024', {
      field: 'experience.startDate',
      timestamp: '2026-06-30T00:00:00.000Z',
    });

    expect(result.value).toBe('2024-01');
  });

  it('rejects unsupported dates', () => {
    const normalizer = new DateNormalizer();

    expect(() =>
      normalizer.normalize('Spring 2024', {
        field: 'experience.startDate',
        timestamp: '2026-06-30T00:00:00.000Z',
      }),
    ).toThrow('invalid');
  });
});
