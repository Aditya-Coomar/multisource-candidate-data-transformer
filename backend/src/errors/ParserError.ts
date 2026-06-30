import { ExtractionError } from './ExtractionError';

export class ParserError extends ExtractionError {
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
      code: 'PARSER_FAILURE',
      source: options.source,
      recoverable: options.recoverable ?? false,
      details: options.details,
      cause: options.cause,
    });
    this.name = 'ParserError';
  }
}
