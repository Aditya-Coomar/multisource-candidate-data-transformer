import { ValidationError } from '../../errors';
import { createNormalizationOperation } from '../../models/normalization-operation';
import type {
  NormalizationContext,
  NormalizationResult,
} from '../base/normalization.context';
import type { Normalizer } from '../base/normalizer.interface';

const EMAIL_FIELDS = new Set(['contactInfo.email']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('');
}

export class EmailNormalizer implements Normalizer<string> {
  public readonly name = 'EmailNormalizer';

  supports(field: string): boolean {
    return EMAIL_FIELDS.has(field);
  }

  normalize(
    value: string,
    context: NormalizationContext,
  ): NormalizationResult<string> {
    const sanitized = stripControlCharacters(value).trim().toLowerCase();

    if (!EMAIL_PATTERN.test(sanitized)) {
      throw new ValidationError('Email address is invalid.', {
        field: context.field,
        originalValue: value,
        normalizer: this.name,
      });
    }

    return {
      value: sanitized,
      operation:
        sanitized === value
          ? undefined
          : createNormalizationOperation({
              field: context.field,
              normalizer: this.name,
              originalValue: value,
              normalizedValue: sanitized,
              timestamp: context.timestamp,
            }),
    };
  }

  validate(value: string): boolean {
    return EMAIL_PATTERN.test(value);
  }
}
