import type { NextFunction, Response } from 'express';
import { ZodError } from 'zod';
import { RequestValidationError, UploadError } from '../errors';
import type { AppRequest } from '../types/http';
import { projectionConfigSchema } from '../types/schemas';
import { parseProjectionConfigOrDefault } from '../utils/validators';
import {
  transformRequestSchema,
  validateConfigRequestSchema,
} from '../validators/request/transform.schema';

function parseJsonField(value: unknown, field: string): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new RequestValidationError(`Invalid JSON in "${field}".`, {
      field,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function parseProjectionConfigField(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function validateTransformRequest(
  req: AppRequest,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const files = Array.isArray(req.files) ? req.files : [];

    if (files.length === 0) {
      throw new UploadError('At least one file upload is required.', {
        statusCode: 400,
        code: 'MISSING_FILES',
      });
    }

    const parsedBody = transformRequestSchema.parse({
      projectionConfig: parseProjectionConfigField(req.body.projectionConfig),
      sources: req.body.sources
        ? parseJsonField(req.body.sources, 'sources')
        : undefined,
      llm: req.body.llm
        ? parseJsonField(req.body.llm, 'llm')
        : undefined,
    });

    req.body = {
      ...req.body,
      projectionConfig: parseProjectionConfigOrDefault(parsedBody.projectionConfig),
      sources: parsedBody.sources ?? [],
      llm: parsedBody.llm,
    };

    next();
  } catch (error) {
    next(normalizeValidationError(error));
  }
}

export function validateProjectionConfigRequest(
  req: AppRequest,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const payload = validateConfigRequestSchema.parse({
      projectionConfig: req.body.projectionConfig,
    });

    req.body = {
      projectionConfig: projectionConfigSchema.parse(payload.projectionConfig),
    };

    next();
  } catch (error) {
    next(normalizeValidationError(error));
  }
}

function normalizeValidationError(error: unknown): Error {
  if (error instanceof RequestValidationError || error instanceof UploadError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new RequestValidationError('Request validation failed.', error.flatten());
  }

  return error instanceof Error
    ? error
    : new RequestValidationError('Request validation failed.');
}
