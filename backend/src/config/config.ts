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
  CONFIDENCE_SOURCE_WEIGHTS: z.string().optional(),
  CONFIDENCE_FIELD_WEIGHTS: z.string().optional(),
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

const defaultConfidenceSourceWeights = {
  resume: 1,
  ats: 0.95,
  csv: 0.9,
  github: 0.85,
  linkedin: 0.85,
  'recruiter-notes': 0.7,
  'job-board': 0.8,
  'social-profile': 0.8,
  manual: 0.75,
  other: 0.7,
} as const;

const defaultConfidenceFieldWeights = {
  firstName: 0.8,
  middleName: 0.4,
  lastName: 0.8,
  fullName: 1,
  headline: 0.5,
  summary: 0.35,
  location: 0.7,
  contactInfo: 1,
  socialLinks: 0.7,
  experiences: 0.9,
  education: 0.75,
  skills: 0.85,
  tags: 0.25,
  additionalData: 0.3,
} as const;

function parseNumericConfig(
  rawValue: string | undefined,
  defaults: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  if (!rawValue) {
    return defaults;
  }

  const parsed: Record<string, number> = { ...defaults };

  for (const entry of rawValue.split(',')) {
    const [rawKey, rawScore] = entry.split(':', 2);
    const key = rawKey?.trim().toLowerCase();
    const score = rawScore ? Number(rawScore.trim()) : Number.NaN;

    if (!key || Number.isNaN(score)) {
      continue;
    }

    parsed[key] = score;
  }

  return Object.freeze(parsed);
}

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
  confidence: {
    sourceWeights: parseNumericConfig(
      env.CONFIDENCE_SOURCE_WEIGHTS,
      defaultConfidenceSourceWeights,
    ),
    fieldWeights: parseNumericConfig(
      env.CONFIDENCE_FIELD_WEIGHTS,
      defaultConfidenceFieldWeights,
    ),
    pipelineVersion: 'phase-6-confidence-provenance-v1',
    engineVersion: 'confidence-engine-v1',
    mergeStrategyVersion: 'merge-engine-v1',
  },
} as const;
