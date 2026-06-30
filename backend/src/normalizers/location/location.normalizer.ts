import { createNormalizationOperation } from '../../models/normalization-operation';
import type {
  NormalizationContext,
  NormalizationResult,
} from '../base/normalization.context';
import type { Normalizer } from '../base/normalizer.interface';

const LOCATION_FIELDS = new Set([
  'location.city',
  'location.region',
  'location.country',
  'location.formatted',
]);

const CITY_ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru',
  bengaluru: 'Bengaluru',
  bombay: 'Mumbai',
};

const COUNTRY_ALIASES: Record<string, string> = {
  in: 'IN',
  india: 'IN',
  us: 'US',
  usa: 'US',
  'united states': 'US',
  uk: 'GB',
  'united kingdom': 'GB',
};

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('');
}

export class LocationNormalizer implements Normalizer<string> {
  public readonly name = 'LocationNormalizer';

  supports(field: string): boolean {
    return LOCATION_FIELDS.has(field);
  }

  normalize(
    value: string,
    context: NormalizationContext,
  ): NormalizationResult<string> {
    const sanitized = stripControlCharacters(value).trim();
    const key = sanitized.toLowerCase();
    const normalized =
      context.field === 'location.country'
        ? COUNTRY_ALIASES[key] ?? sanitized.toUpperCase()
        : CITY_ALIASES[key] ?? this.toTitleCase(sanitized);

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

  private toTitleCase(value: string): string {
    return value
      .split(/\s+/)
      .map((segment) =>
        segment ? `${segment[0].toUpperCase()}${segment.slice(1).toLowerCase()}` : segment,
      )
      .join(' ');
  }
}
