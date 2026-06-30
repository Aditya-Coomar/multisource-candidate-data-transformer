import { ExtractionError } from './ExtractionError';

export class MalformedInputError extends ExtractionError {
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
      code: 'MALFORMED_INPUT',
      source: options.source,
      recoverable: options.recoverable ?? false,
      details: options.details,
      cause: options.cause,
    });
    this.name = 'MalformedInputError';
  }
}
