export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      code?: string;
      details?: unknown;
      isOperational?: boolean;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = options?.statusCode ?? 500;
    this.code = options?.code ?? 'INTERNAL_SERVER_ERROR';
    this.details = options?.details;
    this.isOperational = options?.isOperational ?? true;
  }
}
