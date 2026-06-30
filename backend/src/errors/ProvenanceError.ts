import { AppError } from './AppError';

type ProvenanceErrorOptions = {
  candidateId: string;
  field?: string;
  reason: string;
  recoverable?: boolean;
  details?: Readonly<Record<string, unknown>>;
  cause?: Error;
};

export class ProvenanceError extends AppError {
  public readonly candidateId: string;
  public readonly field?: string;
  public readonly reason: string;
  public readonly recoverable: boolean;

  constructor(message: string, options: ProvenanceErrorOptions) {
    super(message, {
      statusCode: 500,
      code: 'PROVENANCE_ERROR',
      isOperational: true,
      details: {
        candidateId: options.candidateId,
        field: options.field,
        reason: options.reason,
        recoverable: options.recoverable ?? false,
        ...(options.details ?? {}),
      },
      cause: options.cause,
    });

    this.name = 'ProvenanceError';
    this.candidateId = options.candidateId;
    this.field = options.field;
    this.reason = options.reason;
    this.recoverable = options.recoverable ?? false;
  }
}
