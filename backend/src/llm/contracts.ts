import { z } from 'zod';

export const llmStageNameSchema = z.enum([
  'extraction',
  'normalization',
  'merge',
  'confidence',
  'semantic-validation',
]);

export type LLMStageName = z.infer<typeof llmStageNameSchema>;

export const llmFailureModeSchema = z.enum(['fallback', 'hard-fail']);

export const llmModeSchema = z.enum(['hybrid', 'deterministic-only']);

export const llmDecisionEnvelopeSchema = z
  .object({
    stage: llmStageNameSchema,
    inputHash: z.string().min(1),
    model: z.string().min(1),
    decision: z.record(z.string(), z.unknown()),
    rationale: z.string().min(1).optional(),
    evidence: z.array(z.string().min(1)).default([]),
    confidence: z.number().min(0).max(1),
    recoverable: z.boolean(),
  })
  .strict();

export type LLMDecisionEnvelope = z.infer<typeof llmDecisionEnvelopeSchema>;

export const semanticWarningSchema = z
  .object({
    code: z.string().min(1),
    severity: z.enum(['info', 'warn', 'error']).default('warn'),
    message: z.string().min(1),
    candidateIndex: z.number().int().nonnegative().optional(),
    fieldPath: z.string().min(1).optional(),
  })
  .strict();

export type SemanticWarning = z.infer<typeof semanticWarningSchema>;

export const llmExplanationSchema = z
  .object({
    candidateId: z.string().min(1).optional(),
    fieldPath: z.string().min(1),
    summary: z.string().min(1),
    supportingSources: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type LLMExplanation = z.infer<typeof llmExplanationSchema>;

export const llmPolicySchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: llmModeSchema.optional(),
    stages: z.array(llmStageNameSchema).optional(),
    strictGrounding: z.boolean().optional(),
    maxLatencyMs: z.number().int().positive().optional(),
    includeExplanations: z.boolean().optional(),
    onLlmFailure: llmFailureModeSchema.optional(),
  })
  .strict();

export type LLMPolicyInput = z.infer<typeof llmPolicySchema>;
