import { z } from 'zod';
import { uuidSchema } from './common.schema';
import { confidenceScoreSchema } from './confidence-score.schema';
import { locationSchema } from './location.schema';
import { provenanceSchema } from './provenance.schema';

export const educationSchema = z
  .object({
    id: uuidSchema,
    institution: z.string().min(1),
    degree: z.string().min(1).optional(),
    fieldOfStudy: z.string().min(1).optional(),
    grade: z.string().min(1).optional(),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    location: locationSchema.optional(),
    provenance: z.array(provenanceSchema).default([]),
    confidence: z.array(confidenceScoreSchema).default([]),
  })
  .passthrough();
