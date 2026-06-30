import { z } from 'zod';
import { skillLevelSchema, uuidSchema } from './common.schema';
import { confidenceScoreSchema } from './confidence-score.schema';
import { provenanceSchema } from './provenance.schema';

export const skillSchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1),
    category: z.string().min(1).optional(),
    level: skillLevelSchema.optional(),
    yearsOfExperience: z.number().min(0).optional(),
    provenance: z.array(provenanceSchema).default([]),
    confidence: z.array(confidenceScoreSchema).default([]),
  })
  .passthrough();
