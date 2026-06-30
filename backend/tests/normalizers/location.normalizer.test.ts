import { describe, expect, it } from 'vitest';
import { LocationNormalizer } from '../../src/normalizers/location/location.normalizer';

describe('LocationNormalizer', () => {
  it('normalizes alternate city spellings', () => {
    const normalizer = new LocationNormalizer();
    const result = normalizer.normalize('Bangalore', {
      field: 'location.city',
      timestamp: '2026-06-30T00:00:00.000Z',
    });

    expect(result.value).toBe('Bengaluru');
  });

  it('normalizes country values to ISO codes', () => {
    const normalizer = new LocationNormalizer();
    const result = normalizer.normalize('India', {
      field: 'location.country',
      timestamp: '2026-06-30T00:00:00.000Z',
    });

    expect(result.value).toBe('IN');
  });
});
