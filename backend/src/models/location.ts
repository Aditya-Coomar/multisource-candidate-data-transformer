import { randomUUID } from 'node:crypto';
import type {
  ConfidenceCarrier,
  IdentifiableEntity,
  ProvenanceCarrier,
} from '../interfaces/base-entity.interface';

/**
 * Canonical location data with normalized geographic parts when available.
 */
export interface Location
  extends IdentifiableEntity,
    ProvenanceCarrier,
    ConfidenceCarrier {
  readonly raw?: string;
  readonly city?: string;
  readonly region?: string;
  readonly country?: string;
  readonly postalCode?: string;
  readonly formatted?: string;
}

/**
 * Creates immutable location data.
 */
export function createLocation(
  input: Partial<Location> = {},
): Location {
  return Object.freeze({
    id: input.id ?? randomUUID(),
    raw: input.raw,
    city: input.city,
    region: input.region,
    country: input.country,
    postalCode: input.postalCode,
    formatted: input.formatted,
    provenance: Object.freeze([...(input.provenance ?? [])]),
    confidence: Object.freeze([...(input.confidence ?? [])]),
  });
}
