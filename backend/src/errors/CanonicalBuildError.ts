import { AppError } from './AppError';

type CanonicalBuildErrorOptions = {
  groupId: string;
  field?: string;
  reason: string;
  recoverable?: boolean;
  sourceIds: readonly string[];
  details?: Readonly<Record<string, unknown>>;
  cause?: Error;
};

export class CanonicalBuildError extends AppError {
  public readonly groupId: string;
  public readonly field?: string;
  public readonly reason: string;
  public readonly recoverable: boolean;
  public readonly sourceIds: readonly string[];

  constructor(message: string, options: CanonicalBuildErrorOptions) {
    super(message, {
      statusCode: 500,
      code: 'CANONICAL_BUILD_ERROR',
      isOperational: true,
      details: {
        groupId: options.groupId,
        field: options.field,
        reason: options.reason,
        recoverable: options.recoverable ?? false,
        sourceIds: [...options.sourceIds],
        ...(options.details ?? {}),
      },
      cause: options.cause,
    });

    this.name = 'CanonicalBuildError';
    this.groupId = options.groupId;
    this.field = options.field;
    this.reason = options.reason;
    this.recoverable = options.recoverable ?? false;
    this.sourceIds = Object.freeze([...options.sourceIds]);
  }
}
