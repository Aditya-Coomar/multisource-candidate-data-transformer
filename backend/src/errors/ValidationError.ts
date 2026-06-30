import { NormalizationError } from './NormalizationError';

export class ValidationError extends NormalizationError {
  constructor(
    message: string,
    options: {
      field: string;
      originalValue: unknown;
      normalizer: string;
      recoverable?: boolean;
      cause?: Error;
    },
  ) {
    super(message, {
      field: options.field,
      originalValue: options.originalValue,
      normalizer: options.normalizer,
      recoverable: options.recoverable ?? true,
      cause: options.cause,
    });
    this.name = 'ValidationError';
  }
}
