/**
 * Candidate-level processing metadata produced by the confidence engine.
 */
export interface CandidateMetadata {
  readonly candidateId: string;
  readonly pipelineVersion: string;
  readonly engineVersion: string;
  readonly mergeStrategyVersion: string;
  readonly processingStartedAt: string;
  readonly processingCompletedAt: string;
  readonly processingDurationMs: number;
  readonly mergedSources: readonly string[];
  readonly totalSources: number;
  readonly totalFields: number;
}

/**
 * Creates immutable candidate metadata.
 */
export function createCandidateMetadata(
  input: CandidateMetadata,
): CandidateMetadata {
  return Object.freeze({
    candidateId: input.candidateId,
    pipelineVersion: input.pipelineVersion,
    engineVersion: input.engineVersion,
    mergeStrategyVersion: input.mergeStrategyVersion,
    processingStartedAt: input.processingStartedAt,
    processingCompletedAt: input.processingCompletedAt,
    processingDurationMs: input.processingDurationMs,
    mergedSources: Object.freeze([...(input.mergedSources ?? [])]),
    totalSources: input.totalSources,
    totalFields: input.totalFields,
  });
}
