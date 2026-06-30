import { describe, expect, it } from 'vitest';
import { PhoneNormalizer } from '../../src/normalizers/phone/phone.normalizer';

describe('PhoneNormalizer', () => {
  it('normalizes international numbers with formatting noise', () => {
    const normalizer = new PhoneNormalizer();
    const result = normalizer.normalize('+91 98765-43210', {
      field: 'contactInfo.phone',
      timestamp: '2026-06-30T00:00:00.000Z',
    });

    expect(result.value).toBe('+919876543210');
  });

  it('normalizes numbers with 00 prefix', () => {
    const normalizer = new PhoneNormalizer();
    const result = normalizer.normalize('00919876543210', {
      field: 'contactInfo.phone',
      timestamp: '2026-06-30T00:00:00.000Z',
    });

    expect(result.value).toBe('+919876543210');
  });

  it('rejects local numbers without country code', () => {
    const normalizer = new PhoneNormalizer();

    expect(() =>
      normalizer.normalize('(987)6543210', {
        field: 'contactInfo.phone',
        timestamp: '2026-06-30T00:00:00.000Z',
      }),
    ).toThrow('country code');
  });
});
