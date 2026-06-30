import { describe, expect, it } from 'vitest';
import { config } from '../../src/config/config';
import { createContactInfo } from '../../src/models/contact-info';
import { createSkill } from '../../src/models/skill';
import { CandidateGrouper } from '../../src/mergers/grouping/candidate.grouper';
import { MergePlanner } from '../../src/mergers/planner/merge.planner';
import { createMergeCandidate } from './helpers';

describe('MergePlanner', () => {
  it('precomputes strategy, availability, and conflicts before merge execution', () => {
    const candidates = [
      createMergeCandidate('resume', 'resume-plan', {
        fullName: 'Jane Doe',
        summary: 'Backend engineer',
        contactInfo: [
          createContactInfo({
            kind: 'email',
            value: 'jane@example.com',
            isPrimary: true,
          }),
        ],
        skills: [createSkill({ name: 'TypeScript' })],
      }),
      createMergeCandidate('ats', 'ats-plan', {
        fullName: 'Jane Alexandra Doe',
        contactInfo: [
          createContactInfo({
            kind: 'email',
            value: 'jane@example.com',
            isPrimary: true,
          }),
        ],
        skills: [
          createSkill({ name: 'TypeScript' }),
          createSkill({ name: 'PostgreSQL' }),
        ],
      }),
    ];

    const mergeConfig = {
      sourcePriority: [...config.merge.sourcePriority],
      sourceMatchers: { ...config.merge.sourceMatchers },
      identityFallbackEnabled: config.merge.identityFallbackEnabled,
    };
    const grouper = new CandidateGrouper(mergeConfig);
    const planner = new MergePlanner(mergeConfig);

    const group = grouper.group(candidates)[0]!;
    const plan = planner.plan(group);

    expect(plan.allSourceRecordIds).toHaveLength(2);
    expect(plan.fields.fullName.strategyName).toBe('scalar');
    expect(plan.fields.contactInfo.strategyName).toBe('contact');
    expect(plan.fields.skills.strategyName).toBe('array');
    expect(plan.fields.fullName.hasConflict).toBe(true);
    expect(plan.fields.summary.hasConflict).toBe(false);
    expect(plan.fields.summary.missingSourceIds).toHaveLength(1);
    expect(plan.conflictCount).toBeGreaterThanOrEqual(1);
  });
});
