import { ValidationError } from '../../errors';
import { createNormalizationOperation } from '../../models/normalization-operation';
import type {
  NormalizationContext,
  NormalizationResult,
} from '../base/normalization.context';
import type { Normalizer } from '../base/normalizer.interface';

const URL_FIELDS = new Set(['socialLink.url']);

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('');
}

export class UrlNormalizer implements Normalizer<string> {
  public readonly name = 'UrlNormalizer';

  supports(field: string): boolean {
    return URL_FIELDS.has(field);
  }

  normalize(
    value: string,
    context: NormalizationContext,
  ): NormalizationResult<string> {
    const sanitized = stripControlCharacters(value).trim();
    const candidate = /^https?:\/\//i.test(sanitized)
      ? sanitized
      : `https://${sanitized}`;

    let normalized: string;
    try {
      const url = new URL(candidate);
      normalized = url.toString().replace(/\/$/, '');
    } catch (error) {
      throw new ValidationError('URL is invalid.', {
        field: context.field,
        originalValue: value,
        normalizer: this.name,
        cause: error instanceof Error ? error : undefined,
      });
    }

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
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
}
