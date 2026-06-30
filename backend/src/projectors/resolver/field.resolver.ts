import type { CanonicalCandidate } from '../../models';

export class FieldResolver {
  resolve(candidate: CanonicalCandidate, fieldPath: string): unknown {
    if (!fieldPath) {
      return undefined;
    }

    const normalizedPath = fieldPath.replace(/\[(\d+)\]/g, '.$1');
    const segments = normalizedPath.split('.').filter(Boolean);

    let current: unknown = candidate;

    for (const segment of segments) {
      if (current === undefined || current === null) {
        return undefined;
      }

      if (Array.isArray(current)) {
        const index = Number(segment);
        current = Number.isInteger(index) ? current[index] : undefined;
        continue;
      }

      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[segment];
        continue;
      }

      return undefined;
    }

    return current;
  }
}
