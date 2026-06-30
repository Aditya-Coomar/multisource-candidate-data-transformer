import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { ValidationError } from '../../errors';
import { createNormalizationOperation } from '../../models/normalization-operation';
import type {
  NormalizationContext,
  NormalizationResult,
} from '../base/normalization.context';
import type { Normalizer } from '../base/normalizer.interface';

const PHONE_FIELDS = new Set(['contactInfo.phone']);

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('');
}

export class PhoneNormalizer implements Normalizer<string> {
  public readonly name = 'PhoneNormalizer';

  supports(field: string): boolean {
    return PHONE_FIELDS.has(field);
  }

  normalize(
    value: string,
    context: NormalizationContext,
  ): NormalizationResult<string> {
    const sanitized = stripControlCharacters(value).trim();
    const candidate = sanitized.startsWith('00')
      ? `+${sanitized.slice(2)}`
      : sanitized;

    if (!candidate.startsWith('+')) {
      throw new ValidationError('Phone number is missing an explicit country code.', {
        field: context.field,
        originalValue: value,
        normalizer: this.name,
      });
    }

    const phoneNumber = parsePhoneNumberFromString(candidate);

    if (!phoneNumber || !phoneNumber.isValid()) {
      throw new ValidationError('Phone number is invalid.', {
        field: context.field,
        originalValue: value,
        normalizer: this.name,
      });
    }

    const normalized = phoneNumber.number;

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
    return value.startsWith('+');
  }
}
