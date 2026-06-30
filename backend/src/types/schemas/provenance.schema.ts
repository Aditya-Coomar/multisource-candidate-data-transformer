import { z } from 'zod';
import { isoDateStringSchema, uuidSchema } from './common.schema';

export const provenanceSchema = z
  .object({
    id: uuidSchema,
    sourceRecordId: uuidSchema,
    fieldPath: z.string().min(1),
    extractedValue: z.string().min(1).optional(),
    extractor: z.string().min(1).optional(),
    notes: z.string().min(1).optional(),
    winningSourceRecordIds: z.array(uuidSchema).default([]).optional(),
    candidateSourceRecordIds: z.array(uuidSchema).default([]).optional(),
    mergeStrategy: z.string().min(1).optional(),
    discardedValues: z.array(z.string().min(1)).default([]).optional(),
    resolvedAt: isoDateStringSchema.optional(),
  })
  .passthrough();
