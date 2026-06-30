import { createNormalizationOperation } from '../../models/normalization-operation';
import type {
  NormalizationContext,
  NormalizationResult,
} from '../base/normalization.context';
import type { Normalizer } from '../base/normalizer.interface';

const EDUCATION_FIELDS = new Set(['education.degree']);

const DEGREE_MAP: Record<string, string> = {
  'b.tech': 'Bachelor of Technology',
  btech: 'Bachelor of Technology',
  'bachelor of technology': 'Bachelor of Technology',
  'b.sc': 'Bachelor of Science',
  bsc: 'Bachelor of Science',
  'm.tech': 'Master of Technology',
  mtech: 'Master of Technology',
};

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('');
}

export class EducationNormalizer implements Normalizer<string> {
  public readonly name = 'EducationNormalizer';

  supports(field: string): boolean {
    return EDUCATION_FIELDS.has(field);
  }

  normalize(
    value: string,
    context: NormalizationContext,
  ): NormalizationResult<string> {
    const sanitized = stripControlCharacters(value).trim();
    const normalized = DEGREE_MAP[sanitized.toLowerCase()] ?? sanitized;

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
