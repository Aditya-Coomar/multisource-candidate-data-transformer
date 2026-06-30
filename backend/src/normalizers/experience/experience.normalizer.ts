import { createNormalizationOperation } from '../../models/normalization-operation';
import type {
  NormalizationContext,
  NormalizationResult,
} from '../base/normalization.context';
import type { Normalizer } from '../base/normalizer.interface';

const EXPERIENCE_FIELDS = new Set(['experience.duration']);

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('');
}

export class ExperienceNormalizer implements Normalizer<string> {
  public readonly name = 'ExperienceNormalizer';

  supports(field: string): boolean {
    return EXPERIENCE_FIELDS.has(field);
  }

  normalize(
    value: string,
    context: NormalizationContext,
  ): NormalizationResult<string> {
    const sanitized = stripControlCharacters(value).trim();
    const match = sanitized.match(/^(\d+(?:\.\d+)?)\s*(?:years?|yrs?)$/i);
    const normalized = match ? `${Number(match[1])} years` : sanitized;

    return {
      value: normalized,
      operation:
        normalized === value
          ? undefined
          : createNormalizationOperation({
              field: context.field,
              normalizer: this.name,
              originalValue: value,
              normalizedValue: normalized,
              timestamp: context.timestamp,
            }),
    };
  }

  validate(value: string): boolean {
    return value.trim().length > 0;
  }
}
