import { z } from 'zod';
import { contactKindSchema, uuidSchema } from './common.schema';
import { confidenceScoreSchema } from './confidence-score.schema';
import { provenanceSchema } from './provenance.schema';

export const contactInfoSchema = z
  .object({
    id: uuidSchema,
    kind: contactKindSchema,
    value: z.string().min(1),
    label: z.string().min(1).optional(),
    isPrimary: z.boolean().default(false),
    isVerified: z.boolean().default(false),
    provenance: z.array(provenanceSchema).default([]),
    confidence: z.array(confidenceScoreSchema).default([]),
  })
  .passthrough();
