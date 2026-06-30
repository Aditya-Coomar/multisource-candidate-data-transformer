import logger from '../../logger';
import {
  calculateValueCompleteness,
  createDeterministicId,
  mergeUniqueConfidence,
  mergeUniqueProvenance,
  normalizeIdentityValue,
  remapConfidenceScores,
  remapProvenanceRecords,
  resolveSourcePriorityLabel,
  serializeMergeValue,
  stableStringify,
} from '../../mergers/base/merge.context';
import type {
  CanonicalCandidate,
  ConfidenceScore,
  Provenance,
  SourceRecord,
} from '../../models';
import type {
  ConfidenceConfig,
  ConfidenceEnrichmentInput,
  FieldConfidenceComponents,
  FieldConfidenceResult,
  RelatedNormalizedCandidate,
} from './confidence.types';

export interface ConfidenceContext {
  readonly input: ConfidenceEnrichmentInput;
  readonly config: ConfidenceConfig;
  readonly logger: typeof logger;
  readonly processingStartedAt: string;
  readonly processingCompletedAt: string;
  readonly processingDurationMs: number;
}

export function createConfidenceContext(input: {
  enrichmentInput: ConfidenceEnrichmentInput;
  config: ConfidenceConfig;
}): ConfidenceContext {
  const processingStartedAt = input.enrichmentInput.candidate.updatedAt;
  const processingCompletedAt = input.enrichmentInput.candidate.updatedAt;

  return Object.freeze({
    input: input.enrichmentInput,
    config: input.config,
    logger,
    processingStartedAt,
    processingCompletedAt,
    processingDurationMs:
      Date.parse(processingCompletedAt) - Date.parse(processingStartedAt),
  });
}

export {
  calculateValueCompleteness,
  createDeterministicId,
  mergeUniqueConfidence,
  mergeUniqueProvenance,
  normalizeIdentityValue,
  remapConfidenceScores,
  remapProvenanceRecords,
  resolveSourcePriorityLabel,
  serializeMergeValue,
  stableStringify,
};

export function getSourceWeight(
  sourceRecord: SourceRecord | undefined,
  context: ConfidenceContext,
): number {
  if (!sourceRecord) {
    return 0.5;
  }

  const label = resolveSourcePriorityLabel(sourceRecord, {
    sourcePriority: Object.keys(context.config.sourceWeights),
    sourceMatchers: {},
    identityFallbackEnabled: true,
  });

  return context.config.sourceWeights[label] ?? context.config.sourceWeights[sourceRecord.sourceType] ?? 0.7;
}

export function getFieldWeight(
  fieldPath: string,
  context: ConfidenceContext,
): number {
  return context.config.fieldWeights[fieldPath] ?? 0.5;
}

export function getPrimarySourceRecordForField(
  provenance: readonly Provenance[],
  candidate: CanonicalCandidate,
): SourceRecord | undefined {
  const winningSourceId =
    provenance.find((entry) => entry.winningSourceRecordIds?.length)?.winningSourceRecordIds?.[0] ??
    provenance[0]?.sourceRecordId;

  if (!winningSourceId) {
    return candidate.sourceRecords[0];
  }

  return candidate.sourceRecords.find((record) => record.id === winningSourceId);
}

export function buildConfidenceScoreRecord(input: {
  readonly fieldPath: string;
  readonly score: number;
  readonly reason: string;
  readonly sourceRecordId?: string;
  readonly components: FieldConfidenceComponents;
  readonly fieldWeight: number;
  readonly calculatedAt: string;
}): ConfidenceScore {
  return Object.freeze({
    id: createDeterministicId('field-confidence', [
      input.fieldPath,
      String(input.score),
      input.sourceRecordId ?? '',
      input.calculatedAt,
    ]),
    fieldPath: input.fieldPath,
    value: input.score,
    reason: input.reason,
    sourceRecordId: input.sourceRecordId,
    calculatedAt: input.calculatedAt,
    strategy: 'weighted',
    sourceWeight: input.components.sourceWeight,
    agreementScore: input.components.agreementScore,
    completenessScore: input.components.completenessScore,
    validationScore: input.components.validationScore,
    fieldWeight: input.fieldWeight,
  });
}

export function collectAllNormalizationOperations(
  relatedCandidates: readonly RelatedNormalizedCandidate[],
): readonly RelatedNormalizedCandidate['normalizationOperations'][number][] {
  const operations = relatedCandidates.flatMap(
    (candidate) => candidate.normalizationOperations,
  );
  return Object.freeze(operations);
}

export function toAgreementKey(value: unknown): string {
  if (typeof value === 'string') {
    return normalizeIdentityValue(value) ?? '';
  }

  return stableStringify(value);
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

export function createOverallConfidence(
  candidate: CanonicalCandidate,
  fieldResults: readonly FieldConfidenceResult[],
  context: ConfidenceContext,
): ConfidenceScore {
  let weightedTotal = 0;
  let weightTotal = 0;

  for (const result of fieldResults) {
    weightedTotal += result.score * result.fieldWeight;
    weightTotal += result.fieldWeight;
  }

  const score = weightTotal === 0 ? 0 : clampScore(weightedTotal / weightTotal);

  return Object.freeze({
    id: createDeterministicId('overall-confidence', [candidate.id, String(score)]),
    fieldPath: 'overall',
    value: score,
    reason: 'Weighted average across top-level field confidence scores.',
    calculatedAt: context.processingCompletedAt,
    strategy: 'weighted-overall',
  });
}
