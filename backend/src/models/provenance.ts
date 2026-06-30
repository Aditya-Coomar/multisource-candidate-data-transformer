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
    extractedValue: input.extractedValue,
    extractor: input.extractor,
    notes: input.notes,
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
