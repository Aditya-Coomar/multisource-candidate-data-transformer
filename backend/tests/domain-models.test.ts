import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createCanonicalCandidate,
  createConfidenceScore,
  createContactInfo,
  createEducation,
  createExperience,
  createLocation,
  createPartialCandidate,
  createProjectionConfig,
  createProvenance,
  createSkill,
  createSocialLink,
  createSourceRecord,
} from '../src/models';
import {
  canonicalCandidateSchema,
  partialCandidateSchema,
} from '../src/types/schemas';
import {
  validateCanonicalCandidate,
  validatePartialCandidate,
} from '../src/utils/validators';
import { findCircularImports } from './helpers/findCircularImports';

describe('Phase 2 domain models', () => {
  it('constructs an empty canonical candidate with default collections', () => {
    const candidate = createCanonicalCandidate();

    expect(candidate.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(candidate.contactInfo).toEqual([]);
    expect(candidate.socialLinks).toEqual([]);
    expect(candidate.experiences).toEqual([]);
    expect(candidate.education).toEqual([]);
    expect(candidate.skills).toEqual([]);
    expect(candidate.sourceRecords).toEqual([]);
    expect(candidate.provenance).toEqual([]);
    expect(candidate.confidence).toEqual([]);
    expect(candidate.tags).toEqual([]);
    expect(candidate.additionalData).toEqual({});
  });

  it('constructs a populated canonical candidate', () => {
    const sourceRecord = createSourceRecord({
      sourceId: 'resume-1',
      sourceType: 'resume',
      sourceName: 'Candidate Resume',
      fileName: 'candidate-resume.txt',
      mimeType: 'text/plain',
      parser: 'TextParser',
      extractor: 'ResumeExtractor',
    });
    const provenance = createProvenance({
      sourceRecordId: sourceRecord.id,
      fieldPath: 'contactInfo[0].value',
      extractedValue: 'jane@example.com',
    });
    const confidence = createConfidenceScore({
      fieldPath: 'contactInfo[0].value',
      value: 0.98,
      sourceRecordId: sourceRecord.id,
    });
    const location = createLocation({
      city: 'Bengaluru',
      country: 'India',
      provenance: [provenance],
      confidence: [confidence],
    });
    const skill = createSkill({
      name: 'TypeScript',
      level: 'expert',
      provenance: [provenance],
      confidence: [confidence],
    });
    const contact = createContactInfo({
      kind: 'email',
      value: 'jane@example.com',
      isPrimary: true,
      provenance: [provenance],
      confidence: [confidence],
    });
    const socialLink = createSocialLink({
      platform: 'github',
      url: 'https://github.com/janedoe',
      username: 'janedoe',
      provenance: [provenance],
      confidence: [confidence],
    });
    const experience = createExperience({
      employer: 'OpenAI',
      title: 'Engineer',
      isCurrent: true,
      skills: [skill],
      location,
      provenance: [provenance],
      confidence: [confidence],
    });
    const education = createEducation({
      institution: 'Example University',
      degree: 'B.Tech',
      fieldOfStudy: 'Computer Science',
      provenance: [provenance],
      confidence: [confidence],
    });

    const candidate = createCanonicalCandidate({
      fullName: 'Jane Doe',
      location,
      contactInfo: [contact],
      socialLinks: [socialLink],
      experiences: [experience],
      education: [education],
      skills: [skill],
      sourceRecords: [sourceRecord],
      provenance: [provenance],
      confidence: [confidence],
      tags: ['shortlisted'],
      additionalData: { preferredRole: 'Backend Engineer' },
    });

    expect(candidate.fullName).toBe('Jane Doe');
    expect(candidate.contactInfo).toHaveLength(1);
    expect(candidate.experiences[0]?.skills[0]?.name).toBe('TypeScript');
    expect(candidate.sourceRecords[0]?.sourceType).toBe('resume');
    expect(candidate.additionalData).toEqual({
      preferredRole: 'Backend Engineer',
    });
  });

  it('constructs partial candidates with deterministic collection defaults', () => {
    const partial = createPartialCandidate({
      fullName: 'Sparse Candidate',
      headline: 'Open to work',
    });

    expect(partial.fullName).toBe('Sparse Candidate');
    expect(partial.contactInfo).toEqual([]);
    expect(partial.experiences).toEqual([]);
    expect(partial.sourceRecords).toEqual([]);
  });

  it('applies schema defaults for canonical collections', () => {
    const candidate = canonicalCandidateSchema.parse({
      id: 'f4b8d7a5-6fd6-4b9b-9fd9-8c1d8a4b0f42',
      createdAt: '2026-06-30T00:00:00.000Z',
      updatedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(candidate.contactInfo).toEqual([]);
    expect(candidate.sourceRecords).toEqual([]);
    expect(candidate.provenance).toEqual([]);
    expect(candidate.confidence).toEqual([]);
  });

  it('validates successful canonical payloads', () => {
    const candidate = validateCanonicalCandidate({
      id: 'f4b8d7a5-6fd6-4b9b-9fd9-8c1d8a4b0f42',
      fullName: 'Valid Candidate',
      createdAt: '2026-06-30T00:00:00.000Z',
      updatedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(candidate.fullName).toBe('Valid Candidate');
  });

  it('rejects invalid schema payloads', () => {
    expect(() =>
      validateCanonicalCandidate({
        id: 'not-a-uuid',
        createdAt: '2026-06-30T00:00:00.000Z',
        updatedAt: '2026-06-30T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('serializes and deserializes candidates consistently', () => {
    const candidate = createCanonicalCandidate({
      fullName: 'Serialized Candidate',
    });

    const roundTrip = canonicalCandidateSchema.parse(
      JSON.parse(JSON.stringify(candidate)),
    );

    expect(roundTrip.fullName).toBe(candidate.fullName);
    expect(roundTrip.id).toBe(candidate.id);
  });

  it('validates sparse partial candidate payloads', () => {
    const payload = partialCandidateSchema.parse({
      fullName: 'Minimal Candidate',
    });

    expect(validatePartialCandidate(payload).fullName).toBe(
      'Minimal Candidate',
    );
    expect(validatePartialCandidate(payload).contactInfo).toEqual([]);
  });

  it('creates projection config with deterministic defaults', () => {
    const config = createProjectionConfig();

    expect(config.target).toBe('api');
    expect(config.fieldAllowList).toEqual([]);
    expect(config.transforms).toEqual([]);
  });

  it('has no circular imports across the domain package', () => {
    const srcRoot = path.resolve(__dirname, '..', 'src');
    const cycles = findCircularImports([
      path.join(srcRoot, 'models'),
      path.join(srcRoot, 'interfaces'),
      path.join(srcRoot, 'types', 'schemas'),
    ]);

    expect(cycles).toEqual([]);
  });
});
