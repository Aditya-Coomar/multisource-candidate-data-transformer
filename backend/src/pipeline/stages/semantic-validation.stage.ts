import { z } from 'zod';
import logger from '../../logger';
import type { CanonicalCandidate } from '../../models';
import type { LLMRuntimeContext } from '../../llm/runtime';

const semanticValidationResponseSchema = z
  .object({
    warnings: z
      .array(
        z.object({
          code: z.string().min(1),
          severity: z.enum(['info', 'warn', 'error']).default('warn'),
          message: z.string().min(1),
          candidateIndex: z.number().int().nonnegative().optional(),
          fieldPath: z.string().min(1).optional(),
        }),
      )
      .default([]),
    rationale: z.string().optional(),
    evidence: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).default(0.5),
  })
  .strict();

export class SemanticValidationStage {
  async execute(
    canonicalCandidates: readonly CanonicalCandidate[],
    projectedCandidates: readonly Readonly<Record<string, unknown>>[],
    llmContext?: LLMRuntimeContext,
  ): Promise<void> {
    logger.info('semantic-validation.started', {
      candidateCount: projectedCandidates.length,
    });

    for (const [candidateIndex, candidate] of projectedCandidates.entries()) {
      const canonicalCandidate = canonicalCandidates[candidateIndex];

      if (
        canonicalCandidate &&
        hasChronologyConflict(canonicalCandidate)
      ) {
        llmContext?.recordWarning({
          code: 'IMPOSSIBLE_CHRONOLOGY',
          severity: 'warn',
          candidateIndex,
          fieldPath: 'experiences',
          message:
            'One or more experience entries have an end date earlier than the start date.',
        });
      }

      if (!llmContext?.isEnabledFor('semantic-validation')) {
        continue;
      }

      const response = await llmContext.orchestrator.runJson({
        stage: 'semantic-validation',
        responseSchema: semanticValidationResponseSchema,
        input: candidate,
        prompt: [
          'Review the candidate payload for semantic contradictions.',
          'Return JSON with warnings only for grounded issues.',
          'Do not invent facts or infer unsupported claims.',
          JSON.stringify(candidate),
        ].join('\n\n'),
      });

      if (!response.ok) {
        continue;
      }

      llmContext.recordDecision(response.envelope);

      for (const warning of response.data.warnings) {
        llmContext.recordWarning({
          ...warning,
          candidateIndex:
            warning.candidateIndex === undefined
              ? candidateIndex
              : warning.candidateIndex,
        });
      }
    }

    logger.info('semantic-validation.completed', {
      candidateCount: projectedCandidates.length,
    });
  }
}

function hasChronologyConflict(candidate: CanonicalCandidate): boolean {
  return candidate.experiences.some((experience) => {
    if (!experience.startDate || !experience.endDate) {
      return false;
    }

    return experience.endDate < experience.startDate;
  });
}
