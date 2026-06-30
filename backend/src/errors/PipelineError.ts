import { AppError } from './AppError';

export class PipelineError extends AppError {
  constructor(
    message: string,
    options?: {
      code?: string;
      details?: unknown;
      cause?: Error;
    },
  ) {
    super(message, {
      statusCode: 500,
      code: options?.code ?? 'PIPELINE_ERROR',
      details: options?.details,
      isOperational: true,
      cause: options?.cause,
    });

    this.name = 'PipelineError';
  }
}
