import { randomUUID } from 'node:crypto';
import type {
  ConfidenceCarrier,
  IdentifiableEntity,
  ProvenanceCarrier,
} from '../interfaces/base-entity.interface';

/**
 * Canonical representation of an email, phone number, or other contact method.
 */
export interface ContactInfo
  extends IdentifiableEntity,
    ProvenanceCarrier,
    ConfidenceCarrier {
  readonly kind: 'email' | 'phone' | 'website' | 'other';
  readonly value: string;
  readonly label?: string;
  readonly isPrimary: boolean;
  readonly isVerified: boolean;
}

/**
 * Creates immutable contact information with default flags.
 */
export function createContactInfo(
  input: Omit<ContactInfo, 'id' | 'provenance' | 'confidence' | 'isPrimary' | 'isVerified'> &
    Partial<Pick<ContactInfo, 'id' | 'provenance' | 'confidence' | 'isPrimary' | 'isVerified'>>,
): ContactInfo {
  return Object.freeze({
    id: input.id ?? randomUUID(),
    kind: input.kind,
    value: input.value,
    label: input.label,
    isPrimary: input.isPrimary ?? false,
    isVerified: input.isVerified ?? false,
    provenance: Object.freeze([...(input.provenance ?? [])]),
    confidence: Object.freeze([...(input.confidence ?? [])]),
  });
}
