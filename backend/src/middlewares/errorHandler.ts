import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import logger from '../logger';

type ErrorResponse = {
  status: 'error';
  error: {
    code: string;
    message: string;
    correlationId?: string;
    details?: unknown;
  };
};

export function errorHandler(
  error: Error,
  req: Request,
  res: Response<ErrorResponse>,
  next: NextFunction,
): void {
  void next;

  const normalizedError =
    error instanceof AppError
      ? error
      : error instanceof ZodError
        ? new AppError('Validation failed.', {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: error.flatten(),
            cause: error,
          })
        : new AppError('Internal server error.', {
            statusCode: 500,
            code: 'INTERNAL_SERVER_ERROR',
            cause: error,
            isOperational: false,
          });

  logger.error('request.failed', {
    method: req.method,
    path: req.originalUrl,
    statusCode: normalizedError.statusCode,
    code: normalizedError.code,
    details: normalizedError.details,
    stack: normalizedError.stack,
  });

  res.status(normalizedError.statusCode).json({
    status: 'error',
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
      correlationId: req.correlationId,
      ...(normalizedError.details !== undefined && {
        details: normalizedError.details,
      }),
    },
  });
}
