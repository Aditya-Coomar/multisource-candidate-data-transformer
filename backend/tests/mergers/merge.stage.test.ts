import { describe, expect, it } from 'vitest';
import {
  createContactInfo,
  createEducation,
  createExperience,
  createLocation,
  createSkill,
  createSocialLink,
} from '../../src/models';
import { MergeStage } from '../../src/pipeline/stages/merge.stage';
import { validateCanonicalCandidate } from '../../src/utils/validators';
import { createMergeCandidate } from './helpers';

describe('MergeStage', () => {
  it('builds a deterministic canonical candidate with conflict resolution, deduplication, and provenance', async () => {
    const candidates = [
      createMergeCandidate('resume', 'resume-main', {
        receivedAt: '2026-06-30T00:00:00.000Z',
        fullName: 'John',
        headline: 'Senior Backend Engineer',
        location: createLocation({
          city: 'Bengaluru',
          country: 'IN',
        }),
        contactInfo: [
          createContactInfo({
            kind: 'email',
            value: 'john@example.com',
            isPrimary: true,
          }),
          createContactInfo({
            kind: 'phone',
            value: '+15550001111',
            isPrimary: false,
          }),
        ],
        socialLinks: [
          createSocialLink({
            platform: 'github',
            url: 'https://github.com/johnsmith',
          }),
        ],
        skills: [
          createSkill({ name: 'TypeScript' }),
          createSkill({ name: 'Node.js' }),
        ],
        experiences: [
          createExperience({
            employer: 'OpenAI',
            title: 'Engineer',
            startDate: '2023-01',
            endDate: '2024-06',
            isCurrent: false,
            skills: [createSkill({ name: 'TypeScript' })],
          }),
        ],
        education: [
          createEducation({
            institution: 'Example University',
            degree: 'B.Tech',
            fieldOfStudy: 'Computer Science',
            endDate: '2022-05',
          }),
        ],
        tags: ['shortlisted'],
        additionalData: {
          preferredRole: 'Backend',
        },
      }),
      createMergeCandidate('ats', 'ats-main', {
        receivedAt: '2026-06-30T00:05:00.000Z',
        fullName: 'John Alexander Smith',
        headline: 'Backend Engineer',
        location: createLocation({
          city: 'Bengaluru',
          country: 'IN',
          formatted: 'Bengaluru, IN',
        }),
        contactInfo: [
          createContactInfo({
            kind: 'email',
            value: 'john@example.com',
            isPrimary: true,
          }),
          createContactInfo({
            kind: 'phone',
            value: '+15550001111',
            isPrimary: true,
          }),
        ],
        socialLinks: [
          createSocialLink({
            platform: 'linkedin',
            url: 'https://linkedin.com/in/johnsmith',
          }),
        ],
        skills: [
          createSkill({ name: 'TypeScript' }),
          createSkill({ name: 'PostgreSQL' }),
        ],
        experiences: [
          createExperience({
            employer: 'OpenAI',
            title: 'Engineer',
            startDate: '2023-03',
            isCurrent: true,
            skills: [createSkill({ name: 'Node.js' })],
          }),
        ],
        education: [
          createEducation({
            institution: 'Example University',
            degree: 'B.Tech',
            fieldOfStudy: 'Computer Science',
            endDate: '2022-12',
          }),
        ],
        tags: ['interviewing'],
        additionalData: {
          preferredRole: 'Platform Engineer',
          timezone: 'UTC',
        },
      }),
      createMergeCandidate('github', 'github-main', {
        receivedAt: '2026-06-30T00:10:00.000Z',
        fullName: 'John Smith',
        socialLinks: [
          createSocialLink({
            platform: 'github',
            url: 'https://github.com/johnsmith',
          }),
        ],
        skills: [createSkill({ name: 'Rust' })],
        experiences: [
          createExperience({
            employer: 'OpenAI',
            title: 'Engineer',
            startDate: '2024-01',
            isCurrent: true,
            skills: [createSkill({ name: 'Rust' })],
          }),
        ],
        education: [
          createEducation({
            institution: 'Example University',
            degree: 'MBA',
            endDate: '2025-05',
          }),
        ],
      }),
    ];

    const stage = new MergeStage();
    const firstRun = await stage.execute(candidates);
    const secondRun = await stage.execute(candidates);
    const canonical = firstRun[0]!;

    expect(firstRun).toHaveLength(1);
    expect(secondRun).toEqual(firstRun);

    expect(canonical.fullName).toBe('John Alexander Smith');
    expect(canonical.headline).toBe('Senior Backend Engineer');
    expect(canonical.contactInfo).toHaveLength(2);
    expect(canonical.socialLinks).toHaveLength(2);
    expect(canonical.skills.map((skill) => skill.name)).toEqual([
      'TypeScript',
      'Node.js',
      'PostgreSQL',
      'Rust',
    ]);
    expect(canonical.tags).toEqual(['shortlisted', 'interviewing']);
    expect(canonical.additionalData).toEqual({
      preferredRole: 'Backend',
      timezone: 'UTC',
    });

    expect(canonical.experiences).toHaveLength(1);
    expect(canonical.experiences[0]?.startDate).toBe('2023-01');
    expect(canonical.experiences[0]?.endDate).toBeUndefined();
    expect(canonical.experiences[0]?.isCurrent).toBe(true);
    expect(canonical.experiences[0]?.skills.map((skill) => skill.name)).toEqual([
      'TypeScript',
      'Node.js',
      'Rust',
    ]);

    expect(canonical.education).toHaveLength(2);
    expect(canonical.education.map((entry) => entry.degree)).toEqual([
      'B.Tech',
      'MBA',
    ]);

    expect(canonical.sourceRecords).toHaveLength(3);
    expect(canonical.createdAt).toBe('2026-06-30T00:00:00.000Z');
    expect(canonical.updatedAt).toBe('2026-06-30T00:10:00.000Z');

    const fullNameProvenance = canonical.provenance.find(
      (entry) => entry.fieldPath === 'fullName',
    );
    expect(fullNameProvenance?.mergeStrategy).toBe('scalar');
    expect(fullNameProvenance?.winningSourceRecordIds?.length).toBeGreaterThan(0);
    expect(fullNameProvenance?.candidateSourceRecordIds).toHaveLength(3);

    const skillsProvenance = canonical.provenance.find(
      (entry) => entry.fieldPath === 'skills',
    );
    expect(skillsProvenance?.mergeStrategy).toBe('array');

    expect(validateCanonicalCandidate(canonical).id).toBe(canonical.id);
  });
});
