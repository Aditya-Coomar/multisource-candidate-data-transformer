import {
  createNormalizedPartialCandidate,
  createSourceRecord,
} from '../../src/models';
import type { NormalizedPartialCandidate, SourceRecord } from '../../src/models';

type MergeTestSourceKind =
  | 'resume'
  | 'ats'
  | 'csv'
  | 'github'
  | 'linkedin'
  | 'recruiter-notes';

const SOURCE_DEFAULTS: Readonly<
  Record<
    MergeTestSourceKind,
    Omit<SourceRecord, 'id' | 'receivedAt' | 'metadata' | 'sourceId'>
  >
> = Object.freeze({
  resume: {
    sourceType: 'resume',
    sourceName: 'Resume Upload',
    fileName: 'resume.txt',
    mimeType: 'text/plain',
    parser: 'TextParser',
    extractor: 'ResumeExtractor',
  },
  ats: {
    sourceType: 'ats',
    sourceName: 'ATS Export',
    fileName: 'ats.json',
    mimeType: 'application/json',
    parser: 'JsonParser',
    extractor: 'AtsJsonExtractor',
  },
  csv: {
    sourceType: 'other',
    sourceName: 'CSV Import',
    fileName: 'candidates.csv',
    mimeType: 'text/csv',
    parser: 'CsvParser',
    extractor: 'CsvExtractor',
  },
  github: {
    sourceType: 'social-profile',
    sourceName: 'GitHub Profile',
    fileName: 'github.json',
    mimeType: 'application/json',
    parser: 'JsonParser',
    extractor: 'GitHubProfileExtractor',
  },
  linkedin: {
    sourceType: 'social-profile',
    sourceName: 'LinkedIn Profile',
    fileName: 'linkedin.json',
    mimeType: 'application/json',
    parser: 'JsonParser',
    extractor: 'LinkedInProfileExtractor',
  },
  'recruiter-notes': {
    sourceType: 'manual',
    sourceName: 'Recruiter Notes',
    fileName: 'notes.txt',
    mimeType: 'text/plain',
    parser: 'TextParser',
    extractor: 'RecruiterNotesExtractor',
  },
});

export function createMergeCandidate(
  sourceKind: MergeTestSourceKind,
  sourceId: string,
  input: Partial<NormalizedPartialCandidate> & { receivedAt?: string } = {},
): NormalizedPartialCandidate {
  const { receivedAt, ...candidateInput } = input;
  const sourceDefaults = SOURCE_DEFAULTS[sourceKind];

  return createNormalizedPartialCandidate({
    ...candidateInput,
    sourceRecords: [
      createSourceRecord({
        sourceId,
        receivedAt: receivedAt ?? '2026-06-30T00:00:00.000Z',
        ...sourceDefaults,
      }),
    ],
  });
}
