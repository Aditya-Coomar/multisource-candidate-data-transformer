import { z } from 'zod';
import { metadataSchema } from './common.schema';
import { contactInfoSchema } from './contact-info.schema';
import { educationSchema } from './education.schema';
import { experienceSchema } from './experience.schema';
import { locationSchema } from './location.schema';
import { normalizationOperationSchema } from './normalization-operation.schema';
import { skillSchema } from './skill.schema';
import { socialLinkSchema } from './social-link.schema';
import { sourceRecordSchema } from './source-record.schema';

export const normalizedPartialCandidateSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    middleName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    fullName: z.string().min(1).optional(),
    headline: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    location: locationSchema.optional(),
    contactInfo: z.array(contactInfoSchema).default([]),
    socialLinks: z.array(socialLinkSchema).default([]),
    experiences: z.array(experienceSchema).default([]),
    education: z.array(educationSchema).default([]),
    skills: z.array(skillSchema).default([]),
    sourceRecords: z.array(sourceRecordSchema).default([]),
    tags: z.array(z.string().min(1)).default([]),
    additionalData: metadataSchema.default({}),
    normalizationOperations: z
      .array(normalizationOperationSchema)
      .default([]),
  })
  .passthrough();
