import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const isoDateStringSchema = z.string().datetime({ offset: true });

export const metadataSchema: z.ZodType<Record<string, unknown>> = z
  .record(z.string(), z.unknown())
  .default({});

export const sourceTypeSchema = z.enum([
  'resume',
  'job-board',
  'ats',
  'social-profile',
  'manual',
  'other',
]);

export const socialPlatformSchema = z.enum([
  'linkedin',
  'github',
  'portfolio',
  'twitter',
  'other',
]);

export const contactKindSchema = z.enum(['email', 'phone', 'website', 'other']);

export const skillLevelSchema = z.enum([
  'beginner',
  'intermediate',
  'advanced',
  'expert',
]);

export const projectionTargetSchema = z.enum([
  'api',
  'csv',
  'json',
  'report',
  'other',
]);
