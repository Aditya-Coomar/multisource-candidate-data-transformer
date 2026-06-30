import { describe, expect, it } from 'vitest';
import { SkillNormalizer } from '../../src/normalizers/skill/skill.normalizer';

describe('SkillNormalizer', () => {
  it('maps synonyms to canonical skill names', () => {
    const normalizer = new SkillNormalizer();
    const result = normalizer.normalize('Java Script', {
      field: 'skill.name',
      timestamp: '2026-06-30T00:00:00.000Z',
    });

    expect(result.value).toBe('JavaScript');
  });

  it('preserves unknown skills with title casing', () => {
    const normalizer = new SkillNormalizer();
    const result = normalizer.normalize('distributed systems', {
      field: 'skill.name',
      timestamp: '2026-06-30T00:00:00.000Z',
    });

    expect(result.value).toBe('Distributed Systems');
  });
});
