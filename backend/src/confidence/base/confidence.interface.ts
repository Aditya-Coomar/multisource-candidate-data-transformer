import type {
  FieldConfidenceComponents,
  FieldConfidenceResult,
} from './confidence.types';
import type { ConfidenceContext } from './confidence.context';

export interface ConfidenceStrategy {
  readonly name: string;
  score(fieldPath: string, value: unknown, context: ConfidenceContext): number;
}

export interface ConfidenceCalculator {
  calculate(
    fieldPath: string,
    value: unknown,
    context: ConfidenceContext,
  ): FieldConfidenceResult;
}

export interface WeightedConfidenceStrategy {
  readonly name: string;
  combine(components: FieldConfidenceComponents): number;
}
