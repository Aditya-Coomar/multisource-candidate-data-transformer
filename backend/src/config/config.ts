import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .default('info'),
  MAX_UPLOAD_SIZE: z.string().trim().min(1).default('10mb'),
  CORS_ORIGINS: z.string().optional(),
  MERGE_SOURCE_PRIORITY: z.string().optional(),
  MERGE_IDENTITY_FALLBACK_ENABLED: z.coerce.boolean().default(true),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');

  throw new Error(`Environment validation failed: ${formattedErrors}`);
}

const env = parsedEnv.data;

const defaultCorsOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];

const defaultMergeSourcePriority = [
  'resume',
  'ats',
  'csv',
  'github',
  'linkedin',
  'recruiter-notes',
  'job-board',
  'social-profile',
  'manual',
  'other',
] as const;

const defaultMergeSourceMatchers = {
  resume: ['resume', 'resumeextractor'],
  ats: ['ats', 'atsjsonextractor'],
  csv: ['csv', 'csvparser'],
  github: ['github'],
  linkedin: ['linkedin'],
  'recruiter-notes': ['recruiter notes', 'recruiter-notes', 'recruiter'],
  'job-board': ['job-board', 'job board'],
  'social-profile': ['social-profile', 'social profile'],
  manual: ['manual'],
  other: ['other'],
} as const;

export const config = {
  app: {
    name: 'multisource-candidate-data-transformer-backend',
    version: '1.0.0',
  },
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  maxUploadSize: env.MAX_UPLOAD_SIZE,
  corsOrigins: env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : defaultCorsOrigins,
  merge: {
    sourcePriority: env.MERGE_SOURCE_PRIORITY
      ? env.MERGE_SOURCE_PRIORITY.split(',')
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean)
      : [...defaultMergeSourcePriority],
    identityFallbackEnabled: env.MERGE_IDENTITY_FALLBACK_ENABLED,
    sourceMatchers: defaultMergeSourceMatchers,
  },
} as const;
