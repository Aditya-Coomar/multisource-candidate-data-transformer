export type ExtractionErrorCode =
  | 'EMPTY_INPUT'
  | 'MALFORMED_INPUT'
  | 'PARSER_FAILURE'
  | 'UNSUPPORTED_SOURCE'
  | 'EXTRACTOR_FAILURE';

export class ExtractionError extends Error {
  public readonly code: ExtractionErrorCode;
  public readonly source: string;
  public readonly recoverable: boolean;
  public readonly details?: Readonly<Record<string, unknown>>;
  public readonly cause?: Error;

  constructor(
    message: string,
    options: {
      code: ExtractionErrorCode;
      source: string;
      recoverable: boolean;
      details?: Readonly<Record<string, unknown>>;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'ExtractionError';
    this.code = options.code;
    this.source = options.source;
    this.recoverable = options.recoverable;
    this.details = options.details;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}
