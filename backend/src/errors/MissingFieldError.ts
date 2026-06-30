import { ProjectionError } from './ProjectionError';

export class MissingFieldError extends ProjectionError {
  constructor(field: string, policy: string, configPath?: string) {
    super(`Missing projected field "${field}"`, {
      field,
      policy,
      reason: 'resolved value was undefined',
      recoverable: policy !== 'error',
      configPath,
    });

    this.name = 'MissingFieldError';
  }
}
