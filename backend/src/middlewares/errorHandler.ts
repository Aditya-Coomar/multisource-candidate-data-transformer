import { NextFunction, Request, Response } from 'express';
import multer, { type MulterError } from 'multer';
import { ZodError } from 'zod';
import { AppError, UploadError } from '../errors';
import logger from '../logger';

type ErrorResponse = {
  success: false;
  requestId?: string;
  error: {
    code: string;
    message: string;
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
      : error instanceof multer.MulterError
        ? normalizeMulterError(error)
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
    success: false,
    requestId: req.correlationId,
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
      ...(normalizedError.details !== undefined && {
        details: normalizedError.details,
      }),
    },
  });
}

function normalizeMulterError(error: MulterError): UploadError {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new UploadError('Uploaded file exceeds the allowed size.', {
      statusCode: 413,
      code: 'FILE_TOO_LARGE',
    });
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return new UploadError('Too many uploaded files.', {
      statusCode: 400,
      code: 'TOO_MANY_FILES',
    });
  }

  return new UploadError('Upload processing failed.', {
    statusCode: 400,
    code: 'UPLOAD_ERROR',
    details: { multerCode: error.code },
  });
}
