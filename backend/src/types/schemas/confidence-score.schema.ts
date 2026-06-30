import { z } from 'zod';
import { isoDateStringSchema, uuidSchema } from './common.schema';

export const confidenceScoreSchema = z
  .object({
    id: uuidSchema,
    fieldPath: z.string().min(1),
    value: z.number().min(0).max(1),
    reason: z.string().min(1).optional(),
    sourceRecordId: uuidSchema.optional(),
    calculatedAt: isoDateStringSchema.optional(),
    strategy: z.string().min(1).optional(),
    sourceWeight: z.number().min(0).max(1).optional(),
    agreementScore: z.number().min(0).max(1).optional(),
    completenessScore: z.number().min(0).max(1).optional(),
    validationScore: z.number().min(0).max(1).optional(),
    fieldWeight: z.number().min(0).optional(),
  })
  .passthrough();
