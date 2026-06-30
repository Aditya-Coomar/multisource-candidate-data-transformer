import { ProjectionError } from './ProjectionError';

export class ComputedFieldError extends ProjectionError {
  constructor(field: string, reason: string, cause?: Error) {
    super(`Failed to compute projected field "${field}"`, {
      field,
      reason,
      recoverable: false,
      configPath: `computedFields.${field}`,
      cause,
    });

    this.name = 'ComputedFieldError';
  }
}
