import { config } from '../../config/config';
import logger from '../../logger';
import { createConfidenceContext } from '../../confidence/base/confidence.context';
import type { ConfidenceConfig, RelatedNormalizedCandidate } from '../../confidence/base/confidence.types';
import { ConfidenceBuilder } from '../../confidence/builders/confidence.builder';
import { createDeterministicId, getStableSourceRecordsForCandidate } from '../../mergers/base/merge.context';
import { CandidateGrouper } from '../../mergers/grouping/candidate.grouper';
import type { CanonicalCandidate, NormalizedPartialCandidate } from '../../models';

export class ConfidenceStage {
  private readonly confidenceConfig: ConfidenceConfig;
  private readonly candidateGrouper;
  private readonly confidenceBuilder: ConfidenceBuilder;

  constructor(confidenceConfig?: Partial<ConfidenceConfig>) {
    this.confidenceConfig = Object.freeze({
      sourceWeights:
        confidenceConfig?.sourceWeights ?? { ...config.confidence.sourceWeights },
      fieldWeights:
        confidenceConfig?.fieldWeights ?? { ...config.confidence.fieldWeights },
      pipelineVersion:
        confidenceConfig?.pipelineVersion ?? config.confidence.pipelineVersion,
      engineVersion:
        confidenceConfig?.engineVersion ?? config.confidence.engineVersion,
      mergeStrategyVersion:
        confidenceConfig?.mergeStrategyVersion ??
        config.confidence.mergeStrategyVersion,
    });
    this.candidateGrouper = new CandidateGrouper({
      sourcePriority: [...config.merge.sourcePriority],
      sourceMatchers: { ...config.merge.sourceMatchers },
      identityFallbackEnabled: config.merge.identityFallbackEnabled,
    });
    this.confidenceBuilder = new ConfidenceBuilder();
  }

  async execute(
    canonicalCandidates: readonly CanonicalCandidate[],
    normalizedCandidates: readonly NormalizedPartialCandidate[],
  ): Promise<readonly CanonicalCandidate[]> {
    logger.info('confidence.started', {
      candidateCount: canonicalCandidates.length,
    });

    const groupedCandidates = this.candidateGrouper.group(normalizedCandidates);
    const relatedCandidatesByCanonicalId = new Map<string, readonly RelatedNormalizedCandidate[]>();

    for (const group of groupedCandidates) {
      const canonicalId = createDeterministicId('canonical-candidate', [group.groupId]);
      relatedCandidatesByCanonicalId.set(
        canonicalId,
        Object.freeze(
          group.candidates.map((groupedCandidate) =>
            Object.freeze({
              candidate: groupedCandidate.candidate,
              stableSourceRecords: getStableSourceRecordsForCandidate(
                groupedCandidate,
                group,
              ),
              normalizationOperations:
                groupedCandidate.candidate.normalizationOperations,
            }),
          ),
        ),
      );
    }

    const enrichedCandidates = canonicalCandidates.map((candidate) => {
      const relatedNormalizedCandidates =
        relatedCandidatesByCanonicalId.get(candidate.id) ?? [];
      const context = createConfidenceContext({
        enrichmentInput: {
          candidate,
          normalizedCandidates: relatedNormalizedCandidates,
        },
        config: this.confidenceConfig,
      });
      const enrichedCandidate = this.confidenceBuilder.build(context);

      logger.info('confidence.candidate.finished', {
        candidateId: candidate.id,
      });

      return enrichedCandidate;
    });

    logger.info('confidence.finished', {
      candidateCount: enrichedCandidates.length,
    });

    return Object.freeze(enrichedCandidates);
  }
}
