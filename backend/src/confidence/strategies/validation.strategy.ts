import type { ConfidenceStrategy } from '../base/confidence.interface';
import type { ConfidenceContext } from '../base/confidence.context';

export class ValidationStrategy implements ConfidenceStrategy {
  public readonly name = 'validation';

  score(fieldPath: string, value: unknown, context: ConfidenceContext): number {
    void context;

    if (value === undefined || value === null) {
      return 0;
    }

    if (fieldPath === 'contactInfo' && Array.isArray(value)) {
      if (value.length === 0) {
        return 0;
      }

      const scores = value.map((entry) => {
        const candidate = entry as { kind?: string; value?: string };
        if (candidate.kind === 'email') {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.value ?? '') ? 1 : 0.5;
        }

        if (candidate.kind === 'phone') {
          return /^\+\d{8,15}$/.test(candidate.value ?? '') ? 1 : 0.6;
        }

        if (candidate.kind === 'website') {
          return this.isValidUrl(candidate.value) ? 1 : 0.6;
        }

        return 0.8;
      });

      return scores.reduce((total, score) => total + score, 0) / scores.length;
    }

    if (fieldPath === 'socialLinks' && Array.isArray(value)) {
      if (value.length === 0) {
        return 0;
      }

      const scores = value.map((entry) =>
        this.isValidUrl((entry as { url?: string }).url) ? 1 : 0.6,
      );
      return scores.reduce((total, score) => total + score, 0) / scores.length;
    }

    if (typeof value === 'string') {
      return value.trim() ? 1 : 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? 1 : 0;
    }

    return 1;
  }

  private isValidUrl(value: string | undefined): boolean {
    if (!value) {
      return false;
    }

    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
}
