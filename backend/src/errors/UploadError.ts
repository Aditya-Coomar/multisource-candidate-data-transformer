import { AppError } from './AppError';

type UploadErrorOptions = {
  statusCode?: number;
  code?: string;
  details?: unknown;
  recoverable?: boolean;
  cause?: Error;
};

export class UploadError extends AppError {
  public readonly recoverable: boolean;

  constructor(message: string, options: UploadErrorOptions = {}) {
    super(message, {
      statusCode: options.statusCode ?? 400,
      code: options.code ?? 'UPLOAD_ERROR',
      details: options.details,
      isOperational: true,
      cause: options.cause,
    });

    this.name = 'UploadError';
    this.recoverable = options.recoverable ?? true;
  }
}
