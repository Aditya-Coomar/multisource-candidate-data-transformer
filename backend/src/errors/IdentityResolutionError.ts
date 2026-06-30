import { AppError } from './AppError';

type IdentityResolutionErrorOptions = {
  groupId: string;
  field?: string;
  reason: string;
  recoverable?: boolean;
  sourceIds: readonly string[];
  details?: Readonly<Record<string, unknown>>;
  cause?: Error;
};

export class IdentityResolutionError extends AppError {
  public readonly groupId: string;
  public readonly field?: string;
  public readonly reason: string;
  public readonly recoverable: boolean;
  public readonly sourceIds: readonly string[];

  constructor(message: string, options: IdentityResolutionErrorOptions) {
    super(message, {
      statusCode: 422,
      code: 'IDENTITY_RESOLUTION_ERROR',
      isOperational: true,
      details: {
        groupId: options.groupId,
        field: options.field,
        reason: options.reason,
        recoverable: options.recoverable ?? true,
        sourceIds: [...options.sourceIds],
        ...(options.details ?? {}),
      },
      cause: options.cause,
    });

    this.name = 'IdentityResolutionError';
    this.groupId = options.groupId;
    this.field = options.field;
    this.reason = options.reason;
    this.recoverable = options.recoverable ?? true;
    this.sourceIds = Object.freeze([...options.sourceIds]);
  }
}
