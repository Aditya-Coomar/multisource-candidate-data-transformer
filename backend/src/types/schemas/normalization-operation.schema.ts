import { z } from 'zod';
import { isoDateStringSchema } from './common.schema';

export const normalizationOperationSchema = z
  .object({
    field: z.string().min(1),
    normalizer: z.string().min(1),
    originalValue: z.string(),
    normalizedValue: z.string(),
    timestamp: isoDateStringSchema,
  })
  .passthrough();
