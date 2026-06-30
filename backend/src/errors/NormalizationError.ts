export class NormalizationError extends Error {
  public readonly field: string;
  public readonly originalValue: unknown;
  public readonly recoverable: boolean;
  public readonly normalizer: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    options: {
      field: string;
      originalValue: unknown;
      recoverable: boolean;
      normalizer: string;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'NormalizationError';
    this.field = options.field;
    this.originalValue = options.originalValue;
    this.recoverable = options.recoverable;
    this.normalizer = options.normalizer;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}
