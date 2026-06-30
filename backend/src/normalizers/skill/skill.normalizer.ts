import fs from 'node:fs';
import path from 'node:path';
import { createNormalizationOperation } from '../../models/normalization-operation';
import type {
  NormalizationContext,
  NormalizationResult,
} from '../base/normalization.context';
import type { Normalizer } from '../base/normalizer.interface';

const SKILL_FIELDS = new Set(['skill.name']);
const FALLBACK_SKILL_DICTIONARY: Readonly<Record<string, string>> = Object.freeze({
  js: 'JavaScript',
  javascript: 'JavaScript',
  'java script': 'JavaScript',
  ecmascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  node: 'Node.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  reactjs: 'React',
  'react.js': 'React',
  react: 'React',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  golang: 'Go',
  k8s: 'Kubernetes',
  py: 'Python',
});
const skillDictionary = loadSkillDictionary();

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

function loadSkillDictionary(): Readonly<Record<string, string>> {
  const candidatePaths = [
    path.resolve(process.cwd(), 'resources', 'skills.dictionary.json'),
    path.resolve(__dirname, '..', '..', '..', 'resources', 'skills.dictionary.json'),
  ];

  for (const dictionaryPath of candidatePaths) {
    try {
      return Object.freeze(
        JSON.parse(fs.readFileSync(dictionaryPath, 'utf8')) as Record<string, string>,
      );
    } catch {
      continue;
    }
  }

  return FALLBACK_SKILL_DICTIONARY;
}
