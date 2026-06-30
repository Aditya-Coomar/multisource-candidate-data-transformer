import { ExtractionError } from './ExtractionError';

export class EmptyInputError extends ExtractionError {
  constructor(
    message: string,
    options: {
      source: string;
      recoverable?: boolean;
      details?: Readonly<Record<string, unknown>>;
      cause?: Error;
    },
  ) {
    super(message, {
      code: 'EMPTY_INPUT',
      source: options.source,
      recoverable: options.recoverable ?? true,
      details: options.details,
      cause: options.cause,
    });
    this.name = 'EmptyInputError';
  }
}
