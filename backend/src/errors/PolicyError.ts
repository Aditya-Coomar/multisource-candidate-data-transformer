import { ProjectionError } from './ProjectionError';

export class PolicyError extends ProjectionError {
  constructor(field: string, policy: string, reason: string) {
    super(`Projection policy "${policy}" failed for field "${field}"`, {
      field,
      policy,
      reason,
      recoverable: false,
      configPath: `policies.${policy}`,
    });

    this.name = 'PolicyError';
  }
}
