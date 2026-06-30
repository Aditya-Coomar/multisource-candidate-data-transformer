import { describe, expect, it } from 'vitest';
import { config } from '../../src/config/config';
import { createContactInfo } from '../../src/models/contact-info';
import { createExperience } from '../../src/models/experience';
import { createLocation } from '../../src/models/location';
import { createSocialLink } from '../../src/models/social-link';
import { CandidateGrouper } from '../../src/mergers/grouping/candidate.grouper';
import { createMergeCandidate } from './helpers';

describe('CandidateGrouper', () => {
  it('groups candidates deterministically across transitive identifiers', () => {
    const candidates = [
      createMergeCandidate('resume', 'resume-1', {
        contactInfo: [
          createContactInfo({
            kind: 'email',
            value: 'alex@example.com',
            isPrimary: true,
          }),
        ],
      }),
      createMergeCandidate('ats', 'ats-1', {
        contactInfo: [
          createContactInfo({
            kind: 'email',
            value: 'alex@example.com',
            isPrimary: true,
          }),
        ],
        socialLinks: [
          createSocialLink({
            platform: 'github',
            url: 'https://github.com/alexdev',
          }),
        ],
      }),
      createMergeCandidate('github', 'github-1', {
        socialLinks: [
          createSocialLink({
            platform: 'github',
            url: 'https://github.com/alexdev',
          }),
        ],
      }),
      createMergeCandidate('linkedin', 'linkedin-1', {
        socialLinks: [
          createSocialLink({
            platform: 'linkedin',
            url: 'https://linkedin.com/in/someone-else',
          }),
        ],
      }),
    ];

    const grouper = new CandidateGrouper({
      sourcePriority: [...config.merge.sourcePriority],
      sourceMatchers: { ...config.merge.sourceMatchers },
      identityFallbackEnabled: config.merge.identityFallbackEnabled,
    });

    const groups = grouper.group(candidates);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.candidates).toHaveLength(3);
    expect(groups[0]?.identityKeys).toEqual([
      'email:alex@example.com',
      'github:https://github.com/alexdev',
    ]);
    expect(groups[1]?.candidates).toHaveLength(1);
  });

  it('uses the configured fallback identity without merging non-matches', () => {
    const candidates = [
      createMergeCandidate('resume', 'resume-2', {
        fullName: 'Jordan Lee',
        location: createLocation({
          city: 'Bengaluru',
          country: 'IN',
        }),
        experiences: [
          createExperience({
            employer: 'OpenAI',
            title: 'Engineer',
            isCurrent: true,
            startDate: '2025-01',
          }),
        ],
      }),
      createMergeCandidate('csv', 'csv-2', {
        fullName: 'Jordan Lee',
        location: createLocation({
          city: 'Bengaluru',
          country: 'IN',
        }),
        experiences: [
          createExperience({
            employer: 'OpenAI',
            title: 'Engineer',
            isCurrent: true,
            startDate: '2025-03',
          }),
        ],
      }),
      createMergeCandidate('linkedin', 'linkedin-2', {
        fullName: 'Jordan Lee',
        location: createLocation({
          city: 'San Francisco',
          country: 'US',
        }),
        experiences: [
          createExperience({
            employer: 'OpenAI',
            title: 'Engineer',
            isCurrent: true,
            startDate: '2025-03',
          }),
        ],
      }),
    ];

    const grouper = new CandidateGrouper({
      sourcePriority: [...config.merge.sourcePriority],
      sourceMatchers: { ...config.merge.sourceMatchers },
      identityFallbackEnabled: true,
    });

    const groups = grouper.group(candidates);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.candidates).toHaveLength(2);
    expect(groups[0]?.identityKeys).toContain(
      'fallback:jordan lee|openai|bengaluru|in',
    );
    expect(groups[1]?.candidates).toHaveLength(1);
  });
});
