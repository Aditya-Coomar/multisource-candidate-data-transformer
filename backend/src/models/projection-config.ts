import { randomUUID } from 'node:crypto';
import type { IdentifiableEntity } from '../interfaces/base-entity.interface';

/**
 * Runtime projection rules for downstream output formatting.
 */
export interface ProjectionConfig extends IdentifiableEntity {
  readonly target: 'api' | 'csv' | 'json' | 'report' | 'other';
  readonly includeConfidence: boolean;
  readonly includeProvenance: boolean;
  readonly includeSourceRecords: boolean;
  readonly includeNullishFields: boolean;
  readonly fieldAllowList: readonly string[];
  readonly fieldBlockList: readonly string[];
  readonly transforms: readonly string[];
}

/**
 * Creates immutable projection configuration with collection defaults.
 */
export function createProjectionConfig(
  input: Partial<ProjectionConfig> = {},
): ProjectionConfig {
  return Object.freeze({
    id: input.id ?? randomUUID(),
    target: input.target ?? 'api',
    includeConfidence: input.includeConfidence ?? false,
    includeProvenance: input.includeProvenance ?? false,
    includeSourceRecords: input.includeSourceRecords ?? false,
    includeNullishFields: input.includeNullishFields ?? false,
    fieldAllowList: Object.freeze([...(input.fieldAllowList ?? [])]),
    fieldBlockList: Object.freeze([...(input.fieldBlockList ?? [])]),
    transforms: Object.freeze([...(input.transforms ?? [])]),
  });
}
