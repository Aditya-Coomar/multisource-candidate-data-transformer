import { randomUUID } from 'node:crypto';
import type { IdentifiableEntity } from '../interfaces/base-entity.interface';

/**
 * Confidence measurement for a canonical field or entity.
 */
export interface ConfidenceScore extends IdentifiableEntity {
  readonly fieldPath: string;
  readonly value: number;
  readonly reason?: string;
  readonly sourceRecordId?: string;
  readonly calculatedAt?: string;
}

/**
 * Creates immutable confidence data.
 */
export function createConfidenceScore(
  input: Omit<ConfidenceScore, 'id' | 'calculatedAt'> &
    Partial<Pick<ConfidenceScore, 'id' | 'calculatedAt'>>,
): ConfidenceScore {
  return Object.freeze({
    id: input.id ?? randomUUID(),
    fieldPath: input.fieldPath,
    value: input.value,
    reason: input.reason,
    sourceRecordId: input.sourceRecordId,
    calculatedAt: input.calculatedAt ?? new Date().toISOString(),
  });
}
