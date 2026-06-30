import { AppError } from './AppError';

type CalculatorErrorOptions = {
  candidateId: string;
  field?: string;
  strategy?: string;
  reason: string;
  recoverable?: boolean;
  details?: Readonly<Record<string, unknown>>;
  cause?: Error;
};

export class CalculatorError extends AppError {
  public readonly candidateId: string;
  public readonly field?: string;
  public readonly strategy?: string;
  public readonly reason: string;
  public readonly recoverable: boolean;

  constructor(message: string, options: CalculatorErrorOptions) {
    super(message, {
      statusCode: 500,
      code: 'CALCULATOR_ERROR',
      isOperational: true,
      details: {
        candidateId: options.candidateId,
        field: options.field,
        strategy: options.strategy,
        reason: options.reason,
        recoverable: options.recoverable ?? false,
        ...(options.details ?? {}),
      },
      cause: options.cause,
    });

    this.name = 'CalculatorError';
    this.candidateId = options.candidateId;
    this.field = options.field;
    this.strategy = options.strategy;
    this.reason = options.reason;
    this.recoverable = options.recoverable ?? false;
  }
}
