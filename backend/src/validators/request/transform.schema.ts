import { z } from 'zod';

const sourceDescriptorSchema = z
  .object({
    fileName: z.string().trim().min(1).optional(),
    sourceName: z.string().trim().min(1).optional(),
    sourceType: z
      .enum(['resume', 'job-board', 'ats', 'social-profile', 'manual', 'other'])
      .optional(),
  })
  .strict();

export const transformRequestSchema = z
  .object({
    projectionConfig: z.unknown(),
    sources: z.array(sourceDescriptorSchema).optional(),
  })
  .strict();

export const validateConfigRequestSchema = z
  .object({
    projectionConfig: z.unknown(),
  })
  .strict();

export type SourceDescriptor = z.infer<typeof sourceDescriptorSchema>;
