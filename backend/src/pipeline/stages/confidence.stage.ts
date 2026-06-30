import { z } from 'zod';
import { config } from '../../config/config';
import logger from '../../logger';
import { createConfidenceContext } from '../../confidence/base/confidence.context';
import type { ConfidenceConfig, RelatedNormalizedCandidate } from '../../confidence/base/confidence.types';
import { ConfidenceBuilder } from '../../confidence/builders/confidence.builder';
import { createDeterministicId, getStableSourceRecordsForCandidate } from '../../mergers/base/merge.context';
import { CandidateGrouper } from '../../mergers/grouping/candidate.grouper';
import type { CanonicalCandidate, NormalizedPartialCandidate } from '../../models';
import type { LLMRuntimeContext } from '../../llm/runtime';

const confidenceAdvisorSchema = z
  .object({
    fieldExplanations: z
      .array(
        z.object({
          fieldPath: z.string().min(1),
          summary: z.string().min(1),
          supportingSources: z.array(z.string().min(1)).default([]),
        }),
      )
      .default([]),
    warnings: z
      .array(
        z.object({
          code: z.string().min(1),
          severity: z.enum(['info', 'warn', 'error']).default('warn'),
          message: z.string().min(1),
          fieldPath: z.string().min(1).optional(),
        }),
      )
      .default([]),
    rationale: z.string().optional(),
    evidence: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).default(0.5),
  })
  .strict();

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
    llmContext?: LLMRuntimeContext,
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

    const enrichedCandidates: CanonicalCandidate[] = [];

    for (const [index, candidate] of canonicalCandidates.entries()) {
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

      await this.reviewSemanticConfidence(
        enrichedCandidate,
        relatedNormalizedCandidates.map((item) => item.candidate),
        index,
        llmContext,
      );

      enrichedCandidates.push(enrichedCandidate);
    }

    logger.info('confidence.finished', {
      candidateCount: enrichedCandidates.length,
    });

    return Object.freeze(enrichedCandidates);
  }

  private async reviewSemanticConfidence(
    candidate: CanonicalCandidate,
    normalizedCandidates: readonly NormalizedPartialCandidate[],
    candidateIndex: number,
    llmContext?: LLMRuntimeContext,
  ): Promise<void> {
    if (!llmContext?.isEnabledFor('confidence')) {
      return;
    }

    const response = await llmContext.orchestrator.runJson({
      stage: 'confidence',
      responseSchema: confidenceAdvisorSchema,
      input: {
        candidate,
        normalizedCandidates,
      },
      prompt: [
        'Review semantic consistency and explain confidence considerations without changing numeric scores.',
        'Only report grounded contradictions or source disagreements.',
        JSON.stringify({
          candidate,
          normalizedCandidates,
        }),
      ].join('\n\n'),
    });

    if (!response.ok) {
      return;
    }

    llmContext.recordDecision(response.envelope);

    for (const warning of response.data.warnings) {
      llmContext.recordWarning({
        ...warning,
        candidateIndex,
      });
    }

    for (const explanation of response.data.fieldExplanations) {
      llmContext.recordExplanation({
        candidateId: candidate.id,
        ...explanation,
      });
    }
  }
}
