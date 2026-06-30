import { ExtractionError } from './ExtractionError';

export class UnsupportedSourceError extends ExtractionError {
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
      code: 'UNSUPPORTED_SOURCE',
      source: options.source,
      recoverable: options.recoverable ?? false,
      details: options.details,
      cause: options.cause,
    });
    this.name = 'UnsupportedSourceError';
  }
}
