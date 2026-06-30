import { AppError } from './AppError';

export class RequestValidationError extends AppError {
  constructor(message: string, details?: unknown, statusCode = 400) {
    super(message, {
      statusCode,
      code: 'VALIDATION_ERROR',
      details,
      isOperational: true,
    });

    this.name = 'RequestValidationError';
  }
}
