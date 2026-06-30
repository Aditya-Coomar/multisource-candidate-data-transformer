import { ProjectionError } from './ProjectionError';

export class AliasError extends ProjectionError {
  constructor(field: string, alias: string) {
    super(`Invalid alias "${alias}" for field "${field}"`, {
      field,
      reason: 'alias path is empty or unsafe',
      recoverable: false,
      configPath: `rename.${field}`,
      details: { alias },
    });

    this.name = 'AliasError';
  }
}
