import { z } from 'zod';
import { isoDateStringSchema, uuidSchema } from './common.schema';

export const candidateMetadataSchema = z
  .object({
    candidateId: uuidSchema,
    pipelineVersion: z.string().min(1),
    engineVersion: z.string().min(1),
    mergeStrategyVersion: z.string().min(1),
    processingStartedAt: isoDateStringSchema,
    processingCompletedAt: isoDateStringSchema,
    processingDurationMs: z.number().min(0),
    mergedSources: z.array(z.string().min(1)).default([]),
    totalSources: z.number().int().min(0),
    totalFields: z.number().int().min(0),
  })
  .passthrough();
