import { z } from 'zod';
import { socialPlatformSchema, uuidSchema } from './common.schema';
import { confidenceScoreSchema } from './confidence-score.schema';
import { provenanceSchema } from './provenance.schema';

export const socialLinkSchema = z
  .object({
    id: uuidSchema,
    platform: socialPlatformSchema,
    url: z.url(),
    username: z.string().min(1).optional(),
    provenance: z.array(provenanceSchema).default([]),
    confidence: z.array(confidenceScoreSchema).default([]),
  })
  .passthrough();
