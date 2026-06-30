import { describe, expect, it } from 'vitest';
import { createContactInfo } from '../src/models/contact-info';
import { createEducation } from '../src/models/education';
import { createExperience } from '../src/models/experience';
import { createLocation } from '../src/models/location';
import { createPartialCandidate } from '../src/models/partial-candidate';
import { createSkill } from '../src/models/skill';
import { createSocialLink } from '../src/models/social-link';
import { createSourceRecord } from '../src/models/source-record';
import { NormalizeStage } from '../src/pipeline/stages/normalize.stage';

describe('NormalizeStage', () => {
  it('normalizes partial candidates without mutating the original', async () => {
    const sourceRecord = createSourceRecord({
      sourceId: 'resume-1',
      sourceName: 'Resume Upload',
      sourceType: 'resume',
      fileName: 'resume.txt',
      mimeType: 'text/plain',
      receivedAt: '2026-06-30T00:00:00.000Z',
      parser: 'TextParser',
      extractor: 'ResumeExtractor',
    });

    const candidate = createPartialCandidate({
      fullName: '  jane   doe ',
      contactInfo: [
        createContactInfo({
          kind: 'email',
          value: ' John@GMAIL.Com ',
          isPrimary: true,
        }),
        createContactInfo({
          kind: 'phone',
          value: '+91 98765-43210',
          isPrimary: false,
        }),
      ],
      socialLinks: [
        createSocialLink({
          platform: 'github',
          url: 'github.com/janedoe/',
        }),
      ],
      location: createLocation({
        city: 'Bangalore',
        country: 'India',
      }),
      skills: [
        createSkill({ name: 'JS' }),
        createSkill({ name: 'Java Script' }),
      ],
      experiences: [
        createExperience({
          employer: '  Example   Corp  ',
          startDate: 'January 2024',
          endDate: '01/2025',
          isCurrent: false,
          skills: [createSkill({ name: 'nodejs' })],
        }),
      ],
      education: [
        createEducation({
          institution: '  Example University  ',
          degree: 'B.Tech',
          startDate: '2024-01',
          endDate: 'Jan 2025',
        }),
      ],
      sourceRecords: [sourceRecord],
    });

    const stage = new NormalizeStage();
    const results = await stage.execute([candidate]);
    const normalized = results[0];

    expect(candidate.fullName).toBe('  jane   doe ');
    expect(normalized?.fullName).toBe('jane doe');
    expect(normalized?.contactInfo[0]?.value).toBe('john@gmail.com');
    expect(normalized?.contactInfo[1]?.value).toBe('+919876543210');
    expect(normalized?.socialLinks[0]?.url).toBe('https://github.com/janedoe');
    expect(normalized?.location?.city).toBe('Bengaluru');
    expect(normalized?.location?.country).toBe('IN');
    expect(normalized?.skills.map((skill) => skill.name)).toEqual([
      'JavaScript',
    ]);
    expect(normalized?.experiences[0]?.employer).toBe('Example Corp');
    expect(normalized?.experiences[0]?.startDate).toBe('2024-01');
    expect(normalized?.education[0]?.degree).toBe('Bachelor of Technology');
    expect(normalized?.normalizationOperations.length).toBeGreaterThan(0);
  });

  it('keeps recoverable invalid values instead of crashing the whole candidate', async () => {
    const candidate = createPartialCandidate({
      contactInfo: [
        createContactInfo({
          kind: 'phone',
          value: '9876543210',
          isPrimary: true,
        }),
      ],
    });

    const stage = new NormalizeStage();
    const [normalized] = await stage.execute([candidate]);

    expect(normalized?.contactInfo[0]?.value).toBe('9876543210');
  });
});
