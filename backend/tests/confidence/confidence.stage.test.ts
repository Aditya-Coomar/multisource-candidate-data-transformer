import { describe, expect, it, vi } from 'vitest';
import {
  createContactInfo,
  createLocation,
  createPartialCandidate,
  createSourceRecord,
} from '../../src/models';
import { LLMRuntimeContext } from '../../src/llm/runtime';
import { MergeStage } from '../../src/pipeline/stages/merge.stage';
import { ConfidenceStage } from '../../src/pipeline/stages/confidence.stage';
import { NormalizeStage } from '../../src/pipeline/stages/normalize.stage';
import {
  validateCandidateMetadata,
  validateCanonicalCandidate,
} from '../../src/utils/validators';

describe('ConfidenceStage', () => {
  it('enriches canonical candidates with deterministic confidence, metadata, and field lineage', async () => {
    const resumeSource = createSourceRecord({
      sourceId: 'resume-confidence-1',
      sourceType: 'resume',
      sourceName: 'Resume Upload',
      fileName: 'resume.txt',
      mimeType: 'text/plain',
      receivedAt: '2026-06-30T00:00:00.000Z',
      parser: 'TextParser',
      extractor: 'ResumeExtractor',
    });
    const csvSource = createSourceRecord({
      sourceId: 'csv-confidence-1',
      sourceType: 'other',
      sourceName: 'CSV Import',
      fileName: 'candidates.csv',
      mimeType: 'text/csv',
      receivedAt: '2026-06-30T00:01:00.000Z',
      parser: 'CsvParser',
      extractor: 'CsvExtractor',
    });

    const partialCandidates = [
      createPartialCandidate({
        fullName: '  jane   doe ',
        headline: 'Senior Backend Engineer',
        location: createLocation({
          city: 'Bangalore',
          country: 'India',
        }),
        contactInfo: [
          createContactInfo({
            kind: 'email',
            value: ' Jane@GMAIL.Com ',
            isPrimary: true,
          }),
          createContactInfo({
            kind: 'phone',
            value: '+91 98765-43210',
            isPrimary: true,
          }),
        ],
        sourceRecords: [resumeSource],
      }),
      createPartialCandidate({
        fullName: 'Jane Doe',
        headline: 'Backend Engineer',
        location: createLocation({
          city: 'Bangalore',
          country: 'India',
        }),
        contactInfo: [
          createContactInfo({
            kind: 'email',
            value: 'jane@gmail.com',
            isPrimary: true,
          }),
          createContactInfo({
            kind: 'phone',
            value: '+919876543210',
            isPrimary: true,
          }),
        ],
        sourceRecords: [csvSource],
      }),
    ];

    const normalizeStage = new NormalizeStage();
    const mergeStage = new MergeStage();
    const confidenceStage = new ConfidenceStage();

    const normalizedCandidates = await normalizeStage.execute(partialCandidates);
    const canonicalCandidates = await mergeStage.execute(normalizedCandidates);
    const firstRun = await confidenceStage.execute(
      canonicalCandidates,
      normalizedCandidates,
    );
    const secondRun = await confidenceStage.execute(
      canonicalCandidates,
      normalizedCandidates,
    );

    expect(secondRun).toEqual(firstRun);

    const enrichedCandidate = firstRun[0]!;
    const overallConfidence = enrichedCandidate.confidence.find(
      (entry) => entry.fieldPath === 'overall',
    );
    const contactConfidence = enrichedCandidate.confidence.find(
      (entry) => entry.fieldPath === 'contactInfo',
    );
    const headlineConfidence = enrichedCandidate.confidence.find(
      (entry) => entry.fieldPath === 'headline',
    );
    const fullNameProvenance = enrichedCandidate.provenance.filter(
      (entry) => entry.fieldPath === 'fullName',
    );
    const phoneFieldHistory = enrichedCandidate.provenance.find(
      (entry) =>
        entry.fieldPath === 'contactInfo' &&
        entry.normalizer === 'PhoneNormalizer',
    );
    const sourceHistory = enrichedCandidate.provenance.filter((entry) =>
      entry.fieldPath.startsWith('sourceRecords.'),
    );

    expect(enrichedCandidate.candidateMetadata).toBeDefined();
    expect(validateCandidateMetadata(enrichedCandidate.candidateMetadata).candidateId).toBe(
      enrichedCandidate.id,
    );

    expect(overallConfidence?.value).toBeGreaterThan(0);
    expect(contactConfidence?.value).toBeGreaterThan(
      headlineConfidence?.value ?? 0,
    );

    expect(fullNameProvenance.length).toBeGreaterThanOrEqual(2);
    expect(phoneFieldHistory?.originalValue).toBe('+91 98765-43210');
    expect(phoneFieldHistory?.normalizedValue).toBe('+919876543210');
    expect(phoneFieldHistory?.selectedValue).toBe('+919876543210');
    expect(phoneFieldHistory?.sourceName).toBe('Resume Upload');
    expect(sourceHistory).toHaveLength(2);

    expect(enrichedCandidate.contactInfo[0]?.confidence.length).toBeGreaterThan(0);
    expect(validateCanonicalCandidate(enrichedCandidate).id).toBe(
      enrichedCandidate.id,
    );
  });

  it('raises semantic skill confidence when the LLM grounds the value in raw source text', async () => {
    const resumeSource = createSourceRecord({
      sourceId: 'resume-confidence-2',
      sourceType: 'resume',
      sourceName: 'Resume Upload',
      fileName: 'resume.txt',
      mimeType: 'text/plain',
      receivedAt: '2026-06-30T00:00:00.000Z',
      parser: 'TextParser',
      extractor: 'ResumeExtractor',
    });

    const partialCandidates = [
      createPartialCandidate({
        fullName: 'Aditya Coomar',
        skills: [
          {
            id: 'skill-1',
            name: 'C',
            provenance: [],
            confidence: [],
          },
        ],
        additionalData: {
          __sourceEvidence: {
            rawText: 'Programming Languages: Python, C, C++, JavaScript, TypeScript',
            sections: {
              skills: 'Programming Languages: Python, C, C++, JavaScript, TypeScript',
            },
          },
        },
        sourceRecords: [resumeSource],
      }),
    ];

    const normalizeStage = new NormalizeStage();
    const mergeStage = new MergeStage();
    const confidenceStage = new ConfidenceStage();
    const normalizedCandidates = await normalizeStage.execute(partialCandidates);
    const canonicalCandidates = await mergeStage.execute(normalizedCandidates);

    const orchestrator = {
      isAvailable: () => true,
      runJson: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          assessments: [
            {
              fieldPath: 'skills',
              score: 0.95,
              grounded: true,
              rationale: 'The skills section explicitly lists the extracted skills.',
            },
            {
              fieldPath: 'skills.0',
              score: 0.95,
              grounded: true,
              rationale: 'The skill "C" appears explicitly in the skills section.',
            },
          ],
          fieldExplanations: [],
          warnings: [],
          evidence: [],
          confidence: 0.95,
        },
        envelope: {
          stage: 'confidence',
          inputHash: 'test-hash',
          model: 'google/gemini-2.5-flash',
          decision: {},
          evidence: [],
          confidence: 0.95,
          recoverable: true,
        },
      }),
    };
    const llmContext = new LLMRuntimeContext(
      {
        enabled: true,
        mode: 'hybrid',
        stages: ['confidence'],
        strictGrounding: true,
        maxLatencyMs: 10000,
        includeExplanations: true,
        onFailure: 'fallback',
      },
      orchestrator as never,
    );

    const enrichedCandidates = await confidenceStage.execute(
      canonicalCandidates,
      normalizedCandidates,
      llmContext,
    );
    const skillConfidence = enrichedCandidates[0]?.skills[0]?.confidence[0];
    const aggregateSkillsConfidence = enrichedCandidates[0]?.confidence.find(
      (entry) => entry.fieldPath === 'skills',
    );

    expect(skillConfidence?.strategy).toBe('llm-grounded-hybrid');
    expect(skillConfidence?.value).toBeGreaterThan(0.7);
    expect(aggregateSkillsConfidence?.value).toBeGreaterThan(0.7);
  });
});
