import { z } from 'zod';
import { uuidSchema } from './common.schema';
import { confidenceScoreSchema } from './confidence-score.schema';
import { provenanceSchema } from './provenance.schema';

export const locationSchema = z
  .object({
    id: uuidSchema,
    raw: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    postalCode: z.string().min(1).optional(),
    formatted: z.string().min(1).optional(),
    provenance: z.array(provenanceSchema).default([]),
    confidence: z.array(confidenceScoreSchema).default([]),
  })
  .passthrough();
