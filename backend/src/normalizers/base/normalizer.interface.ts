import type {
  NormalizationContext,
  NormalizationResult,
} from './normalization.context';

export interface Normalizer<TValue = unknown> {
  readonly name: string;
  supports(field: string): boolean;
  normalize(value: TValue, context: NormalizationContext): NormalizationResult<TValue>;
  validate(value: TValue): boolean;
}
