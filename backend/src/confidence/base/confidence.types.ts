import type {
  CanonicalCandidate,
  ConfidenceScore,
  NormalizationOperation,
  NormalizedPartialCandidate,
  Provenance,
  SourceRecord,
} from '../../models';

export type ConfidenceTopLevelField =
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'fullName'
  | 'headline'
  | 'summary'
  | 'location'
  | 'contactInfo'
  | 'socialLinks'
  | 'experiences'
  | 'education'
  | 'skills'
  | 'tags'
  | 'additionalData';

export const CONFIDENCE_TOP_LEVEL_FIELDS: readonly ConfidenceTopLevelField[] =
  Object.freeze([
    'firstName',
    'middleName',
    'lastName',
    'fullName',
    'headline',
    'summary',
    'location',
    'contactInfo',
    'socialLinks',
    'experiences',
    'education',
    'skills',
    'tags',
    'additionalData',
  ]);

export interface ConfidenceConfig {
  readonly sourceWeights: Readonly<Record<string, number>>;
  readonly fieldWeights: Readonly<Record<string, number>>;
  readonly pipelineVersion: string;
  readonly engineVersion: string;
  readonly mergeStrategyVersion: string;
}

export interface RelatedNormalizedCandidate {
  readonly candidate: NormalizedPartialCandidate;
  readonly stableSourceRecords: readonly SourceRecord[];
  readonly normalizationOperations: readonly NormalizationOperation[];
}

export interface ConfidenceEnrichmentInput {
  readonly candidate: CanonicalCandidate;
  readonly normalizedCandidates: readonly RelatedNormalizedCandidate[];
}

export interface FieldConfidenceComponents {
  readonly sourceWeight: number;
  readonly agreementScore: number;
  readonly completenessScore: number;
  readonly validationScore: number;
}

export interface FieldConfidenceResult {
  readonly fieldPath: string;
  readonly score: number;
  readonly reason: string;
  readonly sourceRecordId?: string;
  readonly components: FieldConfidenceComponents;
  readonly fieldWeight: number;
  readonly confidence: ConfidenceScore;
}

export interface FieldProvenanceResult {
  readonly fieldPath: string;
  readonly entries: readonly Provenance[];
}
