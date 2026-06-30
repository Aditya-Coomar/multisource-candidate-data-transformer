import { AliasError } from '../../errors';

const PROTOTYPE_POLLUTION_SEGMENTS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

export class AliasMapper {
  map(sourcePath: string, aliases: Readonly<Record<string, string>>): string {
    const alias = aliases[sourcePath] ?? sourcePath;
    const segments = alias.split('.').filter(Boolean);

    if (
      segments.length === 0 ||
      segments.some((segment) => PROTOTYPE_POLLUTION_SEGMENTS.has(segment))
    ) {
      throw new AliasError(sourcePath, alias);
    }

    return alias;
  }
}
