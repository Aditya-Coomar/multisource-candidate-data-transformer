import type { ConfidenceStrategy } from '../base/confidence.interface';
import type { ConfidenceContext } from '../base/confidence.context';
import { calculateValueCompleteness, clampScore } from '../base/confidence.context';

export class CompletenessStrategy implements ConfidenceStrategy {
  public readonly name = 'completeness';

  score(fieldPath: string, value: unknown, context: ConfidenceContext): number {
    void fieldPath;
    void context;

    const rawScore = calculateValueCompleteness(value);
    if (rawScore <= 0) {
      return 0;
    }

    return clampScore(rawScore / 100);
  }
}
