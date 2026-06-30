import { createOverallConfidence } from '../base/confidence.context';
import type { ConfidenceContext } from '../base/confidence.context';
import type { FieldConfidenceResult } from '../base/confidence.types';
import type { ConfidenceScore } from '../../models';

export class OverallCalculator {
  calculate(
    fieldResults: readonly FieldConfidenceResult[],
    context: ConfidenceContext,
  ): ConfidenceScore {
    return createOverallConfidence(context.input.candidate, fieldResults, context);
  }
}
