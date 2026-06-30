import { describe, expect, it } from 'vitest';
import { createContactInfo, createPartialCandidate, createSourceRecord } from '../../src/models';
import { NormalizeStage } from '../../src/pipeline/stages/normalize.stage';
import { MergeStage } from '../../src/pipeline/stages/merge.stage';
import { ConfidenceStage } from '../../src/pipeline/stages/confidence.stage';

describe('ProvenanceBuilder', () => {
  it('preserves merge history, normalization history, and source history without mutating values', async () => {
    const sourceRecord = createSourceRecord({
      sourceId: 'resume-provenance-1',
      sourceType: 'resume',
      sourceName: 'Resume Upload',
      fileName: 'resume.txt',
      mimeType: 'text/plain',
      receivedAt: '2026-06-30T00:00:00.000Z',
      parser: 'TextParser',
      extractor: 'ResumeExtractor',
    });
    const partialCandidate = createPartialCandidate({
      fullName: 'John Doe',
      contactInfo: [
        createContactInfo({
          kind: 'email',
          value: ' John@GMAIL.Com ',
          isPrimary: true,
        }),
      ],
      sourceRecords: [sourceRecord],
    });

    const normalizeStage = new NormalizeStage();
    const mergeStage = new MergeStage();
    const confidenceStage = new ConfidenceStage();

    const normalizedCandidates = await normalizeStage.execute([partialCandidate]);
    const canonicalCandidates = await mergeStage.execute(normalizedCandidates);
    const [enrichedCandidate] = await confidenceStage.execute(
      canonicalCandidates,
      normalizedCandidates,
    );

    expect(canonicalCandidates[0]?.contactInfo[0]?.value).toBe('john@gmail.com');
    expect(enrichedCandidate?.contactInfo[0]?.value).toBe('john@gmail.com');

    const emailHistory = enrichedCandidate?.provenance.find(
      (entry) =>
        entry.fieldPath === 'contactInfo' &&
        entry.normalizer === 'EmailNormalizer',
    );
    const mergeHistory = enrichedCandidate?.provenance.find(
      (entry) => entry.fieldPath === 'contactInfo' && entry.mergeStrategy,
    );
    const sourceHistory = enrichedCandidate?.provenance.find((entry) =>
      entry.fieldPath.startsWith('sourceRecords.'),
    );

    expect(emailHistory?.originalValue).toBe(' John@GMAIL.Com ');
    expect(emailHistory?.normalizedValue).toBe('john@gmail.com');
    expect(emailHistory?.selectedValue).toBe('john@gmail.com');
    expect(mergeHistory?.mergeStrategy).toBeDefined();
    expect(sourceHistory?.extractor).toBe('ResumeExtractor');
  });
});
