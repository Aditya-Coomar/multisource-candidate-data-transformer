/**
 * Shared contract for entities that capture field lineage.
 */
export interface ProvenanceCarrier {
  readonly provenance: readonly unknown[];
}

/**
 * Shared contract for entities that attach confidence independently of provenance.
 */
export interface ConfidenceCarrier {
  readonly confidence: readonly unknown[];
}

/**
 * Shared contract for identifiable domain entities.
 */
export interface IdentifiableEntity {
  readonly id: string;
}
