import type { PartialCandidate } from '../../models/partial-candidate';
import type { SourceRecord } from '../../models/source-record';

export type IngestionSourceType = SourceRecord['sourceType'];

export interface IngestionSource {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceType: IngestionSourceType;
  readonly fileName: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
  readonly size: number;
  readonly receivedAt: string;
}

export interface ParsedCsvContent {
  readonly kind: 'csv';
  readonly headers: readonly string[];
  readonly rows: readonly Record<string, string>[];
  readonly rowCount: number;
}

export interface ParsedJsonContent {
  readonly kind: 'json';
  readonly data: unknown;
}

export interface ParsedTextContent {
  readonly kind: 'text';
  readonly text: string;
}

export type ParsedContent =
  | ParsedCsvContent
  | ParsedJsonContent
  | ParsedTextContent;

export interface ExtractionResult {
  readonly partialCandidates: readonly PartialCandidate[];
}
