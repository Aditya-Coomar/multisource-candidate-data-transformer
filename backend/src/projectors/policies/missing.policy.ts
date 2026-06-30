import { MissingFieldError } from '../../errors';
import type { ProjectionConfig } from '../../models';

export class MissingPolicyEngine {
  apply(
    fieldPath: string,
    value: unknown,
    policy: ProjectionConfig['missingValuePolicy'],
  ): { readonly include: boolean; readonly value: unknown } {
    if (value !== undefined) {
      return { include: true, value };
    }

    switch (policy) {
      case 'omit':
        return { include: false, value: undefined };
      case 'null':
        return { include: true, value: null };
      case 'error':
        throw new MissingFieldError(fieldPath, policy, `fields.${fieldPath}`);
    }
  }
}
