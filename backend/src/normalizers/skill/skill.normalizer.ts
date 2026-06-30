import fs from 'node:fs';
import path from 'node:path';
import { createNormalizationOperation } from '../../models/normalization-operation';
import type {
  NormalizationContext,
  NormalizationResult,
} from '../base/normalization.context';
import type { Normalizer } from '../base/normalizer.interface';

const SKILL_FIELDS = new Set(['skill.name']);
const skillDictionaryPath = path.resolve(
  process.cwd(),
  'resources',
  'skills.dictionary.json',
);
const skillDictionary = JSON.parse(
  fs.readFileSync(skillDictionaryPath, 'utf8'),
) as Record<string, string>;

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('');
}

export class SkillNormalizer implements Normalizer<string> {
  public readonly name = 'SkillNormalizer';

  supports(field: string): boolean {
    return SKILL_FIELDS.has(field);
  }

  normalize(
    value: string,
    context: NormalizationContext,
  ): NormalizationResult<string> {
    const sanitized = stripControlCharacters(value).trim();
    const key = sanitized.toLowerCase().replace(/\s+/g, ' ');
    const normalized = skillDictionary[key] ?? this.toTitleCase(sanitized);

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
