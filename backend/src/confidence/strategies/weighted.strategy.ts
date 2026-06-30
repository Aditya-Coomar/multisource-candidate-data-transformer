import { clampScore } from '../base/confidence.context';
import type {
  FieldConfidenceComponents,
} from '../base/confidence.types';
import type { WeightedConfidenceStrategy } from '../base/confidence.interface';

export class WeightedStrategy implements WeightedConfidenceStrategy {
  public readonly name = 'weighted';

  combine(components: FieldConfidenceComponents): number {
    return clampScore(
      components.sourceWeight *
        components.agreementScore *
        components.completenessScore *
        components.validationScore,
    );
  }
}
