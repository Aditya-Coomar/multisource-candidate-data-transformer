import { randomUUID } from 'node:crypto';
import type { IdentifiableEntity } from '../interfaces/base-entity.interface';

export type ProjectionMissingValuePolicy = 'omit' | 'null' | 'error';
export type ProjectionArrayFormat = 'preserve' | 'comma-separated';
export type ProjectionPhoneFormat = 'raw' | 'e164';
export type ProjectionDateFormat = 'iso' | 'mm/yyyy' | 'yyyy';
export type ProjectionLocationFormat = 'readable' | 'iso-country';

export interface ProjectionFieldFormatting {
  readonly array?: ProjectionArrayFormat;
  readonly phone?: ProjectionPhoneFormat;
  readonly date?: ProjectionDateFormat;
  readonly location?: ProjectionLocationFormat;
  readonly joinWith?: string;
}

/**
 * Runtime projection rules for transforming canonical candidates into
 * downstream output shapes without mutating the source model.
 */
export interface ProjectionConfig extends IdentifiableEntity {
  readonly target: 'api' | 'csv' | 'json' | 'report' | 'other';
  readonly fields: readonly string[];
  readonly exclude: readonly string[];
  readonly rename: Readonly<Record<string, string>>;
  readonly computedFields: readonly string[];
  readonly missingValuePolicy: ProjectionMissingValuePolicy;
  readonly formatting: Readonly<Record<string, ProjectionFieldFormatting>>;
  readonly includeConfidence: boolean;
  readonly includeProvenance: boolean;
  readonly includeSourceRecords: boolean;
}

type LegacyProjectionConfig = Partial<{
  fieldAllowList: readonly string[];
  fieldBlockList: readonly string[];
  transforms: readonly string[];
  includeNullishFields: boolean;
}>;

/**
 * Creates immutable projection configuration with runtime defaults.
 */
export function createProjectionConfig(
  input: Partial<ProjectionConfig> & LegacyProjectionConfig = {},
): ProjectionConfig {
  const missingValuePolicy =
    input.missingValuePolicy ??
    (input.includeNullishFields ? 'null' : 'omit');

  return Object.freeze({
    id: input.id ?? randomUUID(),
    target: input.target ?? 'api',
    fields: Object.freeze([...(input.fields ?? input.fieldAllowList ?? [])]),
    exclude: Object.freeze([...(input.exclude ?? input.fieldBlockList ?? [])]),
    rename: Object.freeze({ ...(input.rename ?? {}) }),
    computedFields: Object.freeze([
      ...(input.computedFields ?? input.transforms ?? []),
    ]),
    missingValuePolicy,
    formatting: Object.freeze({ ...(input.formatting ?? {}) }),
    includeConfidence: input.includeConfidence ?? false,
    includeProvenance: input.includeProvenance ?? false,
    includeSourceRecords: input.includeSourceRecords ?? false,
  });
}
