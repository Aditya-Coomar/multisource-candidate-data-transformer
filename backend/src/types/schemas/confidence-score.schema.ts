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
  })
  .passthrough();
