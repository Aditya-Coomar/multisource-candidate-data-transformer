import type {
  ConfidenceCarrier,
  IdentifiableEntity,
  ProvenanceCarrier,
} from './base-entity.interface';
import type { ConfidenceScore } from '../models/confidence-score';
import type { Provenance } from '../models/provenance';
import type { SourceRecord } from '../models/source-record';

/**
 * Aggregate contract implemented by candidate-level records.
 */
export interface CandidateAggregate
  extends IdentifiableEntity,
    ProvenanceCarrier,
    ConfidenceCarrier {
  readonly sourceRecords: readonly SourceRecord[];
  readonly provenance: readonly Provenance[];
  readonly confidence: readonly ConfidenceScore[];
}
