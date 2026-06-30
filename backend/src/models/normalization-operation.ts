/**
 * Metadata describing a deterministic normalization step for later provenance work.
 */
export interface NormalizationOperation {
  readonly field: string;
  readonly normalizer: string;
  readonly originalValue: string;
  readonly normalizedValue: string;
  readonly timestamp: string;
}

/**
 * Creates immutable normalization metadata.
 */
export function createNormalizationOperation(
  input: NormalizationOperation,
): NormalizationOperation {
  return Object.freeze({
    field: input.field,
    normalizer: input.normalizer,
    originalValue: input.originalValue,
    normalizedValue: input.normalizedValue,
    timestamp: input.timestamp,
  });
}
