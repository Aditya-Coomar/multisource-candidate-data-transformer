import { randomUUID } from 'node:crypto';
import type { IdentifiableEntity } from '../interfaces/base-entity.interface';

/**
 * Lineage for an extracted field or entity.
 */
export interface Provenance extends IdentifiableEntity {
  readonly sourceRecordId: string;
  readonly fieldPath: string;
  readonly extractedValue?: string;
  readonly extractor?: string;
  readonly notes?: string;
  readonly originalValue?: string;
  readonly normalizedValue?: string;
  readonly selectedValue?: string;
  readonly sourceName?: string;
  readonly sourcePriority?: number;
  readonly normalizer?: string;
  readonly timestamp?: string;
  readonly winningSourceRecordIds?: readonly string[];
  readonly candidateSourceRecordIds?: readonly string[];
  readonly mergeStrategy?: string;
  readonly discardedValues?: readonly string[];
  readonly resolvedAt?: string;
}

/**
 * Creates immutable provenance data.
 */
export function createProvenance(
  input: Omit<Provenance, 'id'> & Partial<Pick<Provenance, 'id'>>,
): Provenance {
  return Object.freeze({
    id: input.id ?? randomUUID(),
    sourceRecordId: input.sourceRecordId,
    fieldPath: input.fieldPath,
    extractedValue: sanitizeOptionalText(input.extractedValue),
    extractor: sanitizeOptionalText(input.extractor),
    notes: sanitizeOptionalText(input.notes),
    originalValue: sanitizeOptionalText(input.originalValue),
    normalizedValue: sanitizeOptionalText(input.normalizedValue),
    selectedValue: sanitizeOptionalText(input.selectedValue),
    sourceName: sanitizeOptionalText(input.sourceName),
    sourcePriority: input.sourcePriority,
    normalizer: sanitizeOptionalText(input.normalizer),
    timestamp: input.timestamp,
    winningSourceRecordIds: input.winningSourceRecordIds
      ? Object.freeze([...(input.winningSourceRecordIds ?? [])])
      : undefined,
    candidateSourceRecordIds: input.candidateSourceRecordIds
      ? Object.freeze([...(input.candidateSourceRecordIds ?? [])])
      : undefined,
    mergeStrategy: input.mergeStrategy,
    discardedValues: input.discardedValues
      ? Object.freeze([...(input.discardedValues ?? [])])
      : undefined,
    resolvedAt: input.resolvedAt,
  });
}

function sanitizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? value : undefined;
}
