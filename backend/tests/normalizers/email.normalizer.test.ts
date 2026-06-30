import { describe, expect, it } from 'vitest';
import { EmailNormalizer } from '../../src/normalizers/email/email.normalizer';

describe('EmailNormalizer', () => {
  it('lowercases and trims email addresses', () => {
    const normalizer = new EmailNormalizer();
    const result = normalizer.normalize('  John@GMAIL.Com  ', {
      field: 'contactInfo.email',
      timestamp: '2026-06-30T00:00:00.000Z',
    });

    expect(result.value).toBe('john@gmail.com');
  });

  it('rejects invalid email addresses', () => {
    const normalizer = new EmailNormalizer();

    expect(() =>
      normalizer.normalize('not-an-email', {
        field: 'contactInfo.email',
        timestamp: '2026-06-30T00:00:00.000Z',
      }),
    ).toThrow('invalid');
  });
});
