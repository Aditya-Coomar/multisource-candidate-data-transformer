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
});
