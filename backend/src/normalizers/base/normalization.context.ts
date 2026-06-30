import type { NormalizationOperation } from '../../models/normalization-operation';

export interface NormalizationContext {
  readonly field: string;
  readonly timestamp: string;
}

export interface NormalizationResult<TValue> {
  readonly value: TValue;
  readonly operation?: NormalizationOperation;
}
