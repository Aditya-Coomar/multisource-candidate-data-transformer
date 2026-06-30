import type { PartialCandidate } from '../models/partial-candidate';

/**
 * Context provided to extractor implementations in later phases.
 */
export interface ExtractionContext {
  readonly sourceName: string;
  readonly sourceType:
    | 'resume'
    | 'job-board'
    | 'ats'
    | 'social-profile'
    | 'manual'
    | 'other';
  readonly correlationId?: string;
}

/**
 * Contract for source-specific extractors that produce sparse candidate data.
 */
export interface CandidateExtractor<TInput> {
  readonly name: string;
  extract(
    input: TInput,
    context: ExtractionContext,
  ): Promise<PartialCandidate>;
}
