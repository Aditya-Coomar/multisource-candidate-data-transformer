import { z } from 'zod';
import { config } from '../../config/config';
import logger from '../../logger';
import { createConfidenceContext } from '../../confidence/base/confidence.context';
import type { ConfidenceConfig, RelatedNormalizedCandidate } from '../../confidence/base/confidence.types';
import { ConfidenceBuilder } from '../../confidence/builders/confidence.builder';
import { createCanonicalCandidate } from '../../models/canonical-candidate';
import { createConfidenceScore } from '../../models/confidence-score';
import { createEducation } from '../../models/education';
import { createExperience } from '../../models/experience';
import { createSkill } from '../../models/skill';
import { createDeterministicId, getStableSourceRecordsForCandidate } from '../../mergers/base/merge.context';
import { CandidateGrouper } from '../../mergers/grouping/candidate.grouper';
import type {
  CanonicalCandidate,
  ConfidenceScore,
  Education,
  Experience,
  NormalizedPartialCandidate,
  Skill,
} from '../../models';
import type { LLMRuntimeContext } from '../../llm/runtime';

const confidenceAdvisorSchema = z
  .object({
    assessments: z
      .array(
        z
          .object({
            fieldPath: z.string().min(1),
            score: z.number().min(0).max(1),
            grounded: z.boolean().default(true),
            rationale: z.string().optional(),
            evidence: z.array(z.string().min(1)).default([]),
            section: z.string().optional(),
            value: z.string().optional(),
          })
          .passthrough(),
      )
      .default([]),
    fieldExplanations: z
      .array(
        z
          .object({
            fieldPath: z.string().min(1),
            summary: z.string().min(1),
            supportingSources: z.array(z.string().min(1)).default([]),
          })
          .passthrough(),
      )
      .default([]),
    warnings: z
      .array(
        z
          .object({
            code: z.string().min(1),
            severity: z.enum(['info', 'warn', 'error']).default('warn'),
            message: z.string().min(1),
            fieldPath: z.string().min(1).optional(),
          })
          .passthrough(),
      )
      .default([]),
    rationale: z.string().optional(),
    evidence: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).default(0.5),
  })
  .passthrough();

type ConfidenceAssessment = z.infer<typeof confidenceAdvisorSchema>['assessments'][number];

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
      const deterministicCandidate = this.confidenceBuilder.build(context);
      const enrichedCandidate = await this.reviewSemanticConfidence(
        deterministicCandidate,
        relatedNormalizedCandidates,
        index,
        llmContext,
      );

      logger.info('confidence.candidate.finished', {
        candidateId: candidate.id,
      });

      enrichedCandidates.push(enrichedCandidate);
    }

    logger.info('confidence.finished', {
      candidateCount: enrichedCandidates.length,
    });

    return Object.freeze(enrichedCandidates);
  }

  private async reviewSemanticConfidence(
    candidate: CanonicalCandidate,
    normalizedCandidates: readonly RelatedNormalizedCandidate[],
    candidateIndex: number,
    llmContext?: LLMRuntimeContext,
  ): Promise<CanonicalCandidate> {
    if (!llmContext?.isEnabledFor('confidence')) {
      return candidate;
    }

    const evidenceBundle = buildConfidenceEvidence(normalizedCandidates);
    const assessmentTargets = buildAssessmentTargets(candidate);

    if (evidenceBundle.length === 0 || assessmentTargets.length === 0) {
      return candidate;
    }

    const response = await llmContext.orchestrator.runJson({
      stage: 'confidence',
      responseSchema: confidenceAdvisorSchema,
      input: {
        assessmentTargets,
        evidenceBundle,
      },
      prompt: [
        'Score semantic candidate fields using the raw extracted source text and the most relevant section for each field.',
        'Return assessments only for the provided targets.',
        'Score grounding strength, not value length. High scores require explicit support in the raw text or relevant section.',
        JSON.stringify({
          assessmentTargets,
          evidenceBundle,
        }),
      ].join('\n\n'),
    });

    if (!response.ok) {
      return candidate;
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

    for (const assessment of response.data.assessments) {
      if (!assessment.rationale) {
        continue;
      }

      llmContext.recordExplanation({
        candidateId: candidate.id,
        fieldPath: assessment.fieldPath,
        summary: assessment.rationale,
        supportingSources: response.data.fieldExplanations
          .find((explanation) => explanation.fieldPath === assessment.fieldPath)
          ?.supportingSources ?? [],
      });
    }

    return applyGroundedConfidence(
      candidate,
      response.data.assessments,
      this.confidenceConfig.fieldWeights,
    );
  }
}

function buildConfidenceEvidence(
  normalizedCandidates: readonly RelatedNormalizedCandidate[],
): readonly Readonly<Record<string, unknown>>[] {
  const evidence: Readonly<Record<string, unknown>>[] = [];

  for (const normalizedCandidate of normalizedCandidates) {
    const sourceEvidence = normalizedCandidate.candidate.additionalData.__sourceEvidence;

    if (!isRecord(sourceEvidence)) {
      continue;
    }

    evidence.push(
      Object.freeze({
        sourceName:
          normalizedCandidate.stableSourceRecords[0]?.sourceName ?? 'Unknown Source',
        sourceType:
          normalizedCandidate.stableSourceRecords[0]?.sourceType ?? 'other',
        rawText: truncateText(
          typeof sourceEvidence.rawText === 'string' ? sourceEvidence.rawText : '',
          6000,
        ),
        sections: sanitizeStringRecord(sourceEvidence.sections, 2500),
      }),
    );
  }

  return Object.freeze(evidence);
}

function buildAssessmentTargets(
  candidate: CanonicalCandidate,
): readonly Readonly<Record<string, unknown>>[] {
  const targets: Readonly<Record<string, unknown>>[] = [];

  if (candidate.headline) {
    targets.push(
      Object.freeze({
        fieldPath: 'headline',
        value: candidate.headline,
        fieldType: 'headline',
        sectionHint: 'summary',
      }),
    );
  }

  if (candidate.summary) {
    targets.push(
      Object.freeze({
        fieldPath: 'summary',
        value: candidate.summary,
        fieldType: 'summary',
        sectionHint: 'summary',
      }),
    );
  }

  if (candidate.location?.formatted ?? candidate.location?.raw ?? candidate.location?.city) {
    targets.push(
      Object.freeze({
        fieldPath: 'location',
        value: candidate.location,
        fieldType: 'location',
        sectionHint: 'summary',
      }),
    );
  }

  if (candidate.skills.length > 0) {
    targets.push(
      Object.freeze({
        fieldPath: 'skills',
        value: candidate.skills.map((skill) => skill.name),
        fieldType: 'skills',
        sectionHint: 'skills',
      }),
    );
  }

  candidate.skills.forEach((skill, index) => {
    targets.push(
      Object.freeze({
        fieldPath: `skills.${index}`,
        value: skill.name,
        fieldType: 'skill',
        sectionHint: 'skills',
      }),
    );
  });

  if (candidate.experiences.length > 0) {
    targets.push(
      Object.freeze({
        fieldPath: 'experiences',
        value: candidate.experiences.map((experience) => ({
          employer: experience.employer,
          title: experience.title,
        })),
        fieldType: 'experiences',
        sectionHint: 'experience',
      }),
    );
  }

  candidate.experiences.forEach((experience, index) => {
    targets.push(
      Object.freeze({
        fieldPath: `experiences.${index}`,
        value: {
          employer: experience.employer,
          title: experience.title,
          description: experience.description,
        },
        fieldType: 'experience',
        sectionHint: 'experience',
      }),
    );
  });

  if (candidate.education.length > 0) {
    targets.push(
      Object.freeze({
        fieldPath: 'education',
        value: candidate.education.map((entry) => ({
          institution: entry.institution,
          degree: entry.degree,
        })),
        fieldType: 'education',
        sectionHint: 'education',
      }),
    );
  }

  candidate.education.forEach((entry, index) => {
    targets.push(
      Object.freeze({
        fieldPath: `education.${index}`,
        value: {
          institution: entry.institution,
          degree: entry.degree,
          fieldOfStudy: entry.fieldOfStudy,
        },
        fieldType: 'education-entry',
        sectionHint: 'education',
      }),
    );
  });

  return Object.freeze(targets);
}

function applyGroundedConfidence(
  candidate: CanonicalCandidate,
  assessments: readonly ConfidenceAssessment[],
  fieldWeights: Readonly<Record<string, number>>,
): CanonicalCandidate {
  if (assessments.length === 0) {
    return candidate;
  }

  const assessmentMap = new Map(
    assessments.map((assessment) => [assessment.fieldPath, assessment] as const),
  );

  const candidateConfidence = candidate.confidence
    .filter((entry) => entry.fieldPath !== 'overall')
    .map((entry) => {
      const assessment = assessmentMap.get(entry.fieldPath);
      return assessment ? createHybridConfidenceScore(entry, assessment) : entry;
    });

  const skills = candidate.skills.map((skill, index) =>
    updateSkillConfidence(skill, assessmentMap.get(`skills.${index}`)),
  );
  const experiences = candidate.experiences.map((experience, index) =>
    updateExperienceConfidence(
      experience,
      assessmentMap.get(`experiences.${index}`),
    ),
  );
  const education = candidate.education.map((entry, index) =>
    updateEducationConfidence(entry, assessmentMap.get(`education.${index}`)),
  );
  const overall = buildOverallHybridConfidence(
    candidate.id,
    candidateConfidence,
    fieldWeights,
    candidate.updatedAt,
  );

  return createCanonicalCandidate({
    ...candidate,
    skills,
    experiences,
    education,
    confidence: Object.freeze([...candidateConfidence, overall]),
  });
}

function createHybridConfidenceScore(
  current: ConfidenceScore,
  assessment: ConfidenceAssessment,
): ConfidenceScore {
  const llmScore = clampScore(assessment.score);
  const deterministic = clampScore(current.value);
  const weight = assessment.grounded ? 0.8 : 0.4;
  const hybridScore = clampScore(
    deterministic * (1 - weight) + llmScore * weight,
  );

  return createConfidenceScore({
    ...current,
    id: current.id,
    value: hybridScore,
    reason: [
      `Hybrid score from deterministic=${deterministic.toFixed(2)} and llm=${llmScore.toFixed(2)}.`,
      assessment.rationale ? `Grounding: ${assessment.rationale}` : undefined,
    ]
      .filter(Boolean)
      .join(' '),
    strategy: 'llm-grounded-hybrid',
    calculatedAt: current.calculatedAt,
  });
}

function updateSkillConfidence(
  skill: Skill,
  assessment: ConfidenceAssessment | undefined,
): Skill {
  if (!assessment || skill.confidence.length === 0) {
    return skill;
  }

  return createSkill({
    ...skill,
    confidence: (skill.confidence as readonly ConfidenceScore[]).map((entry) =>
      createHybridConfidenceScore(entry, assessment),
    ) as readonly ConfidenceScore[],
  });
}

function updateExperienceConfidence(
  experience: Experience,
  assessment: ConfidenceAssessment | undefined,
): Experience {
  if (!assessment || experience.confidence.length === 0) {
    return experience;
  }

  return createExperience({
    ...experience,
    confidence: (experience.confidence as readonly ConfidenceScore[]).map((entry) =>
      createHybridConfidenceScore(entry, assessment),
    ) as readonly ConfidenceScore[],
  });
}

function updateEducationConfidence(
  education: Education,
  assessment: ConfidenceAssessment | undefined,
): Education {
  if (!assessment || education.confidence.length === 0) {
    return education;
  }

  return createEducation({
    ...education,
    confidence: (education.confidence as readonly ConfidenceScore[]).map((entry) =>
      createHybridConfidenceScore(entry, assessment),
    ) as readonly ConfidenceScore[],
  });
}

function buildOverallHybridConfidence(
  candidateId: string,
  confidences: readonly ConfidenceScore[],
  fieldWeights: Readonly<Record<string, number>>,
  calculatedAt: string,
): ConfidenceScore {
  let weightedTotal = 0;
  let weightTotal = 0;

  for (const confidence of confidences) {
    const weight = fieldWeights[confidence.fieldPath] ?? confidence.fieldWeight ?? 0.5;
    weightedTotal += confidence.value * weight;
    weightTotal += weight;
  }

  const overallValue =
    weightTotal === 0 ? 0 : clampScore(weightedTotal / weightTotal);

  return createConfidenceScore({
    id: createDeterministicId('overall-confidence', [candidateId, 'llm-grounded']),
    fieldPath: 'overall',
    value: overallValue,
    reason: 'Weighted average across top-level field confidence scores after LLM grounding.',
    strategy: 'weighted-overall-llm-grounded',
    calculatedAt,
  });
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function sanitizeStringRecord(
  value: unknown,
  maxLength: number,
): Readonly<Record<string, string>> {
  if (!isRecord(value)) {
    return Object.freeze({});
  }

  const sanitized: Record<string, string> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.trim()) {
      sanitized[key] = truncateText(entry, maxLength);
    }
  }

  return Object.freeze(sanitized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
