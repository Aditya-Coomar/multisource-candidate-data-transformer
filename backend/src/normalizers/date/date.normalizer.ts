import { ValidationError } from '../../errors';
import { createNormalizationOperation } from '../../models/normalization-operation';
import type {
  NormalizationContext,
  NormalizationResult,
} from '../base/normalization.context';
import type { Normalizer } from '../base/normalizer.interface';

const DATE_FIELDS = new Set([
  'experience.startDate',
  'experience.endDate',
  'education.startDate',
  'education.endDate',
]);

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('');
}

const MONTHS: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

export class DateNormalizer implements Normalizer<string> {
  public readonly name = 'DateNormalizer';

  supports(field: string): boolean {
    return DATE_FIELDS.has(field);
  }

  normalize(
    value: string,
    context: NormalizationContext,
  ): NormalizationResult<string> {
    const sanitized = stripControlCharacters(value).trim();
    const normalized = this.toYearMonth(sanitized);

    if (!normalized) {
      throw new ValidationError('Date value is invalid or unsupported.', {
        field: context.field,
        originalValue: value,
        normalizer: this.name,
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
    return /^\d{4}-\d{2}$/.test(value);
  }

  private toYearMonth(value: string): string | undefined {
    const isoMatch = value.match(/^(\d{4})-(\d{2})$/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}`;
    }

    const slashMatch = value.match(/^(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const month = slashMatch[1].padStart(2, '0');
      return `${slashMatch[2]}-${month}`;
    }

    const monthYearMatch = value.match(
      /^([A-Za-z]+)\s+(\d{4})$/,
    );
    if (monthYearMatch) {
      const month = MONTHS[monthYearMatch[1].toLowerCase()];
      if (month) {
        return `${monthYearMatch[2]}-${month}`;
      }
    }

    return undefined;
  }
}
