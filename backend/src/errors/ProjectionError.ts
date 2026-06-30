import { AppError } from './AppError';

type ProjectionErrorOptions = {
  field?: string;
  policy?: string;
  reason: string;
  recoverable?: boolean;
  configPath?: string;
  details?: Readonly<Record<string, unknown>>;
  cause?: Error;
};

export class ProjectionError extends AppError {
  public readonly field?: string;
  public readonly policy?: string;
  public readonly reason: string;
  public readonly recoverable: boolean;
  public readonly configPath?: string;

  constructor(message: string, options: ProjectionErrorOptions) {
    super(message, {
      statusCode: 500,
      code: 'PROJECTION_ERROR',
      isOperational: true,
      details: {
        field: options.field,
        policy: options.policy,
        reason: options.reason,
        recoverable: options.recoverable ?? false,
        configPath: options.configPath,
        ...(options.details ?? {}),
      },
      cause: options.cause,
    });

    this.name = 'ProjectionError';
    this.field = options.field;
    this.policy = options.policy;
    this.reason = options.reason;
    this.recoverable = options.recoverable ?? false;
    this.configPath = options.configPath;
  }
}
