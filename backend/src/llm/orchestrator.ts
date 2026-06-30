import { createHash } from 'node:crypto';
import axios, { AxiosError } from 'axios';
import { z } from 'zod';
import { config } from '../config/config';
import { PipelineError } from '../errors';
import logger from '../logger';
import {
  type LLMDecisionEnvelope,
  llmDecisionEnvelopeSchema,
  type LLMStageName,
} from './contracts';

type LLMRunOptions<TSchema extends z.ZodTypeAny> = {
  readonly stage: LLMStageName;
  readonly responseSchema: TSchema;
  readonly prompt: string;
  readonly input: unknown;
};

type LLMRunResult<TSchema extends z.ZodTypeAny> =
  | {
      readonly ok: true;
      readonly data: z.infer<TSchema>;
      readonly envelope: LLMDecisionEnvelope;
    }
  | {
      readonly ok: false;
      readonly recoverable: boolean;
      readonly reason: string;
    };

type OpenRouterResponse = {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: string;
    };
  }[];
};

export class LLMOrchestrator {
  private readonly cache = new Map<string, unknown>();

  isAvailable(): boolean {
    return (
      config.llm.enabled &&
      Boolean(config.llm.apiKey) &&
      config.llm.mode !== 'deterministic-only'
    );
  }

  async runJson<TSchema extends z.ZodTypeAny>(
    options: LLMRunOptions<TSchema>,
  ): Promise<LLMRunResult<TSchema>> {
    const inputHash = createInputHash(options.stage, options.input);
    const cacheKey = `${options.stage}:${inputHash}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      const parsedCached = llmDecisionEnvelopeSchema.safeParse(cached);
      if (parsedCached.success) {
        const decision = options.responseSchema.safeParse(parsedCached.data.decision);
        if (decision.success) {
          return {
            ok: true,
            data: decision.data,
            envelope: parsedCached.data,
          };
        }
      }
    }

    try {
      const response = await axios.post<OpenRouterResponse>(
        `${config.llm.baseUrl}/chat/completions`,
        {
          model: config.llm.modelByStage[options.stage],
          messages: [
            {
              role: 'system',
              content:
                'Return JSON only. Do not include markdown, code fences, or explanatory text outside the JSON object.',
            },
            {
              role: 'user',
              content: options.prompt,
            },
          ],
          temperature: 0.1,
        },
        {
          headers: {
            Authorization: `Bearer ${config.llm.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': config.llm.appUrl,
            'X-Title': config.app.name,
          },
          timeout: config.llm.timeoutMs,
        },
      );

      const content = response.data.choices?.[0]?.message?.content;

      if (!content) {
        return {
          ok: false,
          recoverable: true,
          reason: 'empty-response',
        };
      }

      const parsedJson = parseJsonObject(content);
      const data = options.responseSchema.parse(parsedJson);
      const envelope = llmDecisionEnvelopeSchema.parse({
        stage: options.stage,
        inputHash,
        model: config.llm.modelByStage[options.stage],
        decision: data,
        rationale:
          typeof parsedJson === 'object' &&
          parsedJson !== null &&
          typeof (parsedJson as Record<string, unknown>).rationale === 'string'
            ? (parsedJson as Record<string, unknown>).rationale
            : undefined,
        evidence:
          typeof parsedJson === 'object' &&
          parsedJson !== null &&
          Array.isArray((parsedJson as Record<string, unknown>).evidence)
            ? (parsedJson as Record<string, unknown>).evidence
            : [],
        confidence:
          typeof parsedJson === 'object' &&
          parsedJson !== null &&
          typeof (parsedJson as Record<string, unknown>).confidence === 'number'
            ? (parsedJson as Record<string, unknown>).confidence
            : 0.5,
        recoverable: true,
      });

      this.cache.set(cacheKey, envelope);

      logger.info('llm.call.completed', {
        stage: options.stage,
        inputHash,
        model: envelope.model,
      });

      return {
        ok: true,
        data,
        envelope,
      };
    } catch (error) {
      const reason = describeLlmError(error);

      logger.warn('llm.call.failed', {
        stage: options.stage,
        inputHash,
        reason,
      });

      if (config.llm.onFailure === 'hard-fail') {
        throw new PipelineError('LLM processing failed.', {
          cause: error instanceof Error ? error : undefined,
        });
      }

      return {
        ok: false,
        recoverable: true,
        reason,
      };
    }
  }
}

function createInputHash(stage: LLMStageName, input: unknown): string {
  return createHash('sha256')
    .update(stage)
    .update(':')
    .update(JSON.stringify(input))
    .digest('hex');
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }

    throw new Error('LLM response was not valid JSON.');
  }
}

function describeLlmError(error: unknown): string {
  if (error instanceof AxiosError) {
    return error.code ?? String(error.response?.status ?? 'axios-error');
  }

  return error instanceof Error ? error.message : String(error);
}
