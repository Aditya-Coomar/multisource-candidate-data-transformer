import { z } from 'zod';
import { uuidSchema } from './common.schema';
import { confidenceScoreSchema } from './confidence-score.schema';
import { locationSchema } from './location.schema';
import { provenanceSchema } from './provenance.schema';
import { skillSchema } from './skill.schema';

export const experienceSchema = z
  .object({
    id: uuidSchema,
    employer: z.string().min(1),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    isCurrent: z.boolean().default(false),
    location: locationSchema.optional(),
    skills: z.array(skillSchema).default([]),
    provenance: z.array(provenanceSchema).default([]),
    confidence: z.array(confidenceScoreSchema).default([]),
  })
  .passthrough();
