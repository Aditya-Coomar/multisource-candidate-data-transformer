import { randomUUID } from 'node:crypto';
import type { IdentifiableEntity } from '../interfaces/base-entity.interface';

/**
 * Metadata describing the origin of extracted candidate information.
 */
export interface SourceRecord extends IdentifiableEntity {
  readonly sourceId: string;
  readonly sourceType:
    | 'resume'
    | 'job-board'
    | 'ats'
    | 'social-profile'
    | 'manual'
    | 'other';
  readonly sourceName: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly receivedAt: string;
  readonly parser: string;
  readonly extractor: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Creates immutable source metadata.
 */
export function createSourceRecord(
  input: Omit<SourceRecord, 'id' | 'receivedAt' | 'metadata'> &
    Partial<Pick<SourceRecord, 'id' | 'receivedAt' | 'metadata'>>,
): SourceRecord {
  return Object.freeze({
    id: input.id ?? randomUUID(),
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    fileName: input.fileName,
    mimeType: input.mimeType,
    receivedAt: input.receivedAt ?? new Date().toISOString(),
    parser: input.parser,
    extractor: input.extractor,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}
