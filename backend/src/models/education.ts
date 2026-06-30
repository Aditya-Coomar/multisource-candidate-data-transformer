import { randomUUID } from 'node:crypto';
import type {
  ConfidenceCarrier,
  IdentifiableEntity,
  ProvenanceCarrier,
} from '../interfaces/base-entity.interface';
import type { Location } from './location';

/**
 * Canonical education history entry.
 */
export interface Education
  extends IdentifiableEntity,
    ProvenanceCarrier,
    ConfidenceCarrier {
  readonly institution: string;
  readonly degree?: string;
  readonly fieldOfStudy?: string;
  readonly grade?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly location?: Location;
}

/**
 * Creates immutable education data with generated identifiers.
 */
export function createEducation(
  input: Omit<Education, 'id' | 'provenance' | 'confidence'> &
    Partial<Pick<Education, 'id' | 'provenance' | 'confidence'>>,
): Education {
  return Object.freeze({
    id: input.id ?? randomUUID(),
    institution: input.institution,
    degree: input.degree,
    fieldOfStudy: input.fieldOfStudy,
    grade: input.grade,
    startDate: input.startDate,
    endDate: input.endDate,
    location: input.location,
    provenance: Object.freeze([...(input.provenance ?? [])]),
    confidence: Object.freeze([...(input.confidence ?? [])]),
  });
}
