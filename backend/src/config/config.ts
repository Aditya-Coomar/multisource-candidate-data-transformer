import dotenv from 'dotenv';
import { z } from 'zod';
import type { LLMStageName } from '../llm/contracts';

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
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  MAX_UPLOAD_FILES: z.coerce.number().int().positive().default(10),
  LLM_ENABLED: z.coerce.boolean().default(true),
  OPENROUTER_API_KEY: z.string().trim().optional(),
  OPENROUTER_BASE_URL: z
    .string()
    .trim()
    .min(1)
    .default('https://openrouter.ai/api/v1'),
  OPENROUTER_APP_URL: z.string().trim().min(1).default('http://localhost:3000'),
  LLM_MODEL: z.string().trim().min(1).default('google/gemini-2.5-flash'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  LLM_RETRY_BUDGET: z.coerce.number().int().min(0).default(1),
  LLM_TOKEN_BUDGET: z.coerce.number().int().positive().default(4096),
  LLM_STAGE_ENABLEMENT: z.string().trim().optional(),
  LLM_STRICT_GROUNDING: z.coerce.boolean().default(true),
  LLM_INCLUDE_EXPLANATIONS: z.coerce.boolean().default(false),
  LLM_ON_FAILURE: z.enum(['fallback', 'hard-fail']).default('fallback'),
  LLM_MODE: z.enum(['hybrid', 'deterministic-only']).default('hybrid'),
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
  'https://multisource-candidate-data-transfor.vercel.app',
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

function parseSizeToBytes(value: string): number {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(\d+)(b|kb|mb|gb)?$/);

  if (!match) {
    return 10 * 1024 * 1024;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 'b';
  const multiplier =
    unit === 'gb'
      ? 1024 * 1024 * 1024
      : unit === 'mb'
        ? 1024 * 1024
        : unit === 'kb'
          ? 1024
          : 1;

  return amount * multiplier;
}

function parseStageList(value: string | undefined): readonly LLMStageName[] {
  const allowedStages = new Set<LLMStageName>([
    'extraction',
    'normalization',
    'merge',
    'confidence',
    'semantic-validation',
  ]);

  if (!value) {
    return Object.freeze([
      'extraction',
      'normalization',
      'merge',
      'confidence',
      'semantic-validation',
    ]);
  }

  return Object.freeze(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry): entry is LLMStageName =>
        allowedStages.has(entry as LLMStageName),
      ),
  );
}

export const config = {
  app: {
    name: 'multisource-candidate-data-transformer-backend',
    version: '1.0.0',
    apiVersion: 'v1',
  },
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
  maxUploadSize: env.MAX_UPLOAD_SIZE,
  maxUploadSizeBytes: parseSizeToBytes(env.MAX_UPLOAD_SIZE),
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
  projection: {
    pipelineVersion: 'phase-7-projection-v1',
  },
  llm: {
    enabled: env.LLM_ENABLED,
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: env.OPENROUTER_BASE_URL.replace(/\/$/, ''),
    appUrl: env.OPENROUTER_APP_URL,
    model: env.LLM_MODEL,
    timeoutMs: env.LLM_TIMEOUT_MS,
    retryBudget: env.LLM_RETRY_BUDGET,
    tokenBudget: env.LLM_TOKEN_BUDGET,
    strictGrounding: env.LLM_STRICT_GROUNDING,
    includeExplanations: env.LLM_INCLUDE_EXPLANATIONS,
    onFailure: env.LLM_ON_FAILURE,
    mode: env.LLM_MODE,
    stages: parseStageList(env.LLM_STAGE_ENABLEMENT),
    modelByStage: {
      extraction: env.LLM_MODEL,
      normalization: env.LLM_MODEL,
      merge: env.LLM_MODEL,
      confidence: env.LLM_MODEL,
      'semantic-validation': env.LLM_MODEL,
    },
  },
  upload: {
    maxFiles: env.MAX_UPLOAD_FILES,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
} as const;
