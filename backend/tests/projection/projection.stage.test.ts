import { describe, expect, it } from 'vitest';
import {
  createCanonicalCandidate,
  createConfidenceScore,
  createContactInfo,
  createEducation,
  createLocation,
  createProjectionConfig,
  createProvenance,
  createSkill,
  createSourceRecord,
} from '../../src/models';
import { MissingFieldError } from '../../src/errors';
import { ProjectionStage } from '../../src/pipeline/stages/projection.stage';
import { transformResponseDataSchema } from '../../src/validators/response/transform.response';

describe('ProjectionStage', () => {
  it('projects canonical candidates into runtime-configured output shapes', async () => {
    const sourceRecord = createSourceRecord({
      sourceId: 'resume-projection-1',
      sourceType: 'resume',
      sourceName: 'Resume Upload',
      fileName: 'resume.txt',
      mimeType: 'text/plain',
      parser: 'TextParser',
      extractor: 'ResumeExtractor',
      receivedAt: '2026-06-30T00:00:00.000Z',
    });
    const emailProvenance = createProvenance({
      sourceRecordId: sourceRecord.id,
      fieldPath: 'contactInfo',
      extractedValue: 'jane@example.com',
      sourceName: 'Resume Upload',
    });
    const emailConfidence = createConfidenceScore({
      fieldPath: 'contactInfo',
      value: 0.97,
      sourceRecordId: sourceRecord.id,
    });
    const candidate = createCanonicalCandidate({
      fullName: 'Jane Doe',
      headline: 'Principal Engineer',
      location: createLocation({
        city: 'Bengaluru',
        country: 'India',
      }),
      contactInfo: [
        createContactInfo({
          kind: 'email',
          value: 'jane@example.com',
          isPrimary: true,
        }),
        createContactInfo({
          kind: 'phone',
          value: '+91 98765-43210',
          isPrimary: true,
        }),
      ],
      skills: [
        createSkill({ name: 'TypeScript', level: 'expert' }),
        createSkill({ name: 'Node.js', level: 'advanced' }),
      ],
      education: [
        createEducation({
          institution: 'Example University',
          degree: 'B.Tech',
        }),
      ],
      provenance: [emailProvenance],
      confidence: [emailConfidence],
      sourceRecords: [sourceRecord],
    });
    const config = createProjectionConfig({
      fields: ['fullName', 'location.country', 'skills'],
      computedFields: ['primary_email', 'skills_count', 'highest_degree'],
      rename: {
        fullName: 'candidate_name',
        'location.country': 'location.country_code',
        primary_email: 'contact.primary_email',
      },
      formatting: {
        skills: {
          array: 'comma-separated',
        },
      },
      includeConfidence: true,
      includeProvenance: true,
      includeSourceRecords: true,
    });
    const stage = new ProjectionStage();

    const [projectedCandidate] = await stage.execute([candidate], config);

    expect(projectedCandidate).toEqual({
      candidate_name: 'Jane Doe',
      location: {
        country_code: 'India',
      },
      skills: 'TypeScript, Node.js',
      contact: {
        primary_email: 'jane@example.com',
      },
      skills_count: 2,
      highest_degree: 'B.Tech',
      confidence: {
        candidate_name: [],
        'location.country_code': [],
        skills: [],
        'contact.primary_email': [],
        skills_count: [],
        highest_degree: [],
      },
      provenance: {
        candidate_name: [],
        'location.country_code': [],
        skills: [],
        'contact.primary_email': [],
        skills_count: [],
        highest_degree: [],
      },
      sourceRecords: [sourceRecord],
    });
  });

  it('emits the assignment default output schema when no fields are configured', async () => {
    const sourceRecord = createSourceRecord({
      sourceId: 'resume-default-schema',
      sourceType: 'resume',
      sourceName: 'Resume Upload',
      fileName: 'resume.txt',
      mimeType: 'text/plain',
      parser: 'TextParser',
      extractor: 'ResumeExtractor',
    });
    const candidate = createCanonicalCandidate({
      fullName: 'Jane Doe',
      headline: 'Senior Backend Engineer',
      location: createLocation({
        city: 'Bengaluru',
        region: 'Karnataka',
        country: 'IN',
      }),
      contactInfo: [
        createContactInfo({ kind: 'email', value: 'jane@example.com', isPrimary: true }),
        createContactInfo({ kind: 'phone', value: '+919876543210', isPrimary: false }),
      ],
      skills: [
        createSkill({ name: 'TypeScript' }),
      ],
      sourceRecords: [sourceRecord],
      provenance: [
        createProvenance({
          sourceRecordId: sourceRecord.id,
          fieldPath: 'fullName',
          sourceName: 'Resume Upload',
          extractor: 'ResumeExtractor',
        }),
      ],
      confidence: [
        createConfidenceScore({
          fieldPath: 'overall',
          value: 0.91,
          sourceRecordId: sourceRecord.id,
        }),
      ],
    });

    const [projectedCandidate] = await new ProjectionStage().execute(
      [candidate],
      createProjectionConfig(),
    );

    expect(Object.keys(projectedCandidate)).toEqual([
      'candidate_id',
      'full_name',
      'emails',
      'phones',
      'location',
      'links',
      'headline',
      'years_experience',
      'skills',
      'experience',
      'education',
      'provenance',
      'overall_confidence',
    ]);
    expect(projectedCandidate).toMatchObject({
      candidate_id: candidate.id,
      full_name: 'Jane Doe',
      emails: ['jane@example.com'],
      phones: ['+919876543210'],
      location: {
        city: 'Bengaluru',
        region: 'Karnataka',
        country: 'IN',
      },
      links: {
        linkedin: null,
        github: null,
        portfolio: null,
        other: [],
      },
      headline: 'Senior Backend Engineer',
      years_experience: null,
      skills: [
        {
          name: 'TypeScript',
          confidence: null,
          sources: ['Resume Upload'],
        },
      ],
      experience: [],
      education: [],
      provenance: [
        {
          field: 'full_name',
          source: 'Resume Upload',
          method: 'ResumeExtractor',
        },
      ],
      overall_confidence: 0.91,
    });
  });

  it('supports assignment-style field specs with from, path, normalize, and snake-case flags', async () => {
    const candidate = createCanonicalCandidate({
      fullName: 'Jane Doe',
      contactInfo: [
        createContactInfo({ kind: 'email', value: 'jane@example.com', isPrimary: true }),
        createContactInfo({ kind: 'phone', value: '+1 (555) 111-2222', isPrimary: true }),
      ],
      skills: [
        createSkill({ name: 'ts' }),
        createSkill({ name: 'nodejs' }),
      ],
    });
    const config = createProjectionConfig({
      fields: [
        { path: 'full_name', from: 'fullName', type: 'string', required: true },
        { path: 'primary_email', from: 'emails[0]', type: 'string', required: true },
        { path: 'phone', from: 'phones[0]', type: 'string', normalize: 'E164' },
        { path: 'skills', from: 'skills[].name', type: 'string[]', normalize: 'canonical' },
      ],
      includeConfidence: true,
      missingValuePolicy: 'null',
    });

    const [projectedCandidate] = await new ProjectionStage().execute(
      [candidate],
      config,
    );

    expect(projectedCandidate).toMatchObject({
      full_name: 'Jane Doe',
      primary_email: 'jane@example.com',
      phone: '+15551112222',
      skills: ['TypeScript', 'Node.js'],
      confidence: {
        full_name: [],
        primary_email: [],
        phone: [],
        skills: [],
      },
    });
  });

  it('supports missing field null policy and metadata injection for matching field paths', async () => {
    const sourceRecord = createSourceRecord({
      sourceId: 'resume-projection-2',
      sourceType: 'resume',
      sourceName: 'Resume Upload',
      fileName: 'resume.txt',
      mimeType: 'text/plain',
      parser: 'TextParser',
      extractor: 'ResumeExtractor',
    });
    const candidate = createCanonicalCandidate({
      fullName: 'Jane Doe',
      contactInfo: [
        createContactInfo({
          kind: 'email',
          value: 'jane@example.com',
          isPrimary: true,
        }),
      ],
      confidence: [
        createConfidenceScore({
          fieldPath: 'contactInfo',
          value: 0.93,
          sourceRecordId: sourceRecord.id,
        }),
      ],
      provenance: [
        createProvenance({
          sourceRecordId: sourceRecord.id,
          fieldPath: 'contactInfo',
          extractedValue: 'jane@example.com',
        }),
      ],
    });
    const config = createProjectionConfig({
      fields: ['summary'],
      computedFields: ['primary_email'],
      rename: {
        primary_email: 'email',
      },
      missingValuePolicy: 'null',
      includeConfidence: true,
      includeProvenance: true,
    });

    const [projectedCandidate] = await new ProjectionStage().execute(
      [candidate],
      config,
    );

    expect(projectedCandidate.summary).toBeNull();
    expect(projectedCandidate.email).toBe('jane@example.com');
    expect(projectedCandidate.confidence).toEqual({
      summary: [],
      email: [],
    });
    expect(projectedCandidate.provenance).toEqual({
      summary: [],
      email: [],
    });
  });

  it('throws when the missing field policy is error', async () => {
    const candidate = createCanonicalCandidate({
      fullName: 'Jane Doe',
    });
    const config = createProjectionConfig({
      fields: ['summary'],
      missingValuePolicy: 'error',
    });

    await expect(
      new ProjectionStage().execute([candidate], config),
    ).rejects.toBeInstanceOf(MissingFieldError);
  });

  it('sanitizes undefined values from structured output so projected JSON stays valid', async () => {
    const sourceRecord = createSourceRecord({
      sourceId: 'resume-projection-3',
      sourceType: 'resume',
      sourceName: 'Resume Upload',
      fileName: 'resume.pdf',
      mimeType: 'application/pdf',
      parser: 'PdfParser',
      extractor: 'ResumeExtractor',
    });
    const candidate = createCanonicalCandidate({
      fullName: 'Jane Doe',
      skills: [
        createSkill({ name: 'TypeScript' }),
      ],
      sourceRecords: [sourceRecord],
    });
    const config = createProjectionConfig({
      fields: ['fullName', 'skills'],
      includeSourceRecords: true,
    });

    const [projectedCandidate] = await new ProjectionStage().execute(
      [candidate],
      config,
    );

    expect(projectedCandidate).toEqual({
      fullName: 'Jane Doe',
      skills: [
        {
          id: expect.any(String),
          name: 'TypeScript',
          provenance: [],
          confidence: [],
        },
      ],
      sourceRecords: [
        {
          id: expect.any(String),
          sourceId: 'resume-projection-3',
          sourceType: 'resume',
          sourceName: 'Resume Upload',
          fileName: 'resume.pdf',
          mimeType: 'application/pdf',
          parser: 'PdfParser',
          extractor: 'ResumeExtractor',
          receivedAt: expect.any(String),
          metadata: {},
        },
      ],
    });

    expect(() =>
      transformResponseDataSchema.parse({
        candidates: [projectedCandidate],
        summary: {
          sourceCount: 1,
          partialCandidateCount: 1,
          normalizedCandidateCount: 1,
          canonicalCandidateCount: 1,
          projectedCandidateCount: 1,
        },
      }),
    ).not.toThrow();
  });
});
