import { z } from 'zod';
import { projectionTargetSchema, uuidSchema } from './common.schema';

export const projectionConfigSchema = z
  .object({
    id: uuidSchema,
    target: projectionTargetSchema.default('api'),
    includeConfidence: z.boolean().default(false),
    includeProvenance: z.boolean().default(false),
    includeSourceRecords: z.boolean().default(false),
    includeNullishFields: z.boolean().default(false),
    fieldAllowList: z.array(z.string().min(1)).default([]),
    fieldBlockList: z.array(z.string().min(1)).default([]),
    transforms: z.array(z.string().min(1)).default([]),
  })
  .passthrough();
