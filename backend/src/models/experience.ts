import { randomUUID } from 'node:crypto';
import type {
  ConfidenceCarrier,
  IdentifiableEntity,
  ProvenanceCarrier,
} from '../interfaces/base-entity.interface';
import type { Location } from './location';
import type { Skill } from './skill';

/**
 * Canonical employment history entry.
 */
export interface Experience
  extends IdentifiableEntity,
    ProvenanceCarrier,
    ConfidenceCarrier {
  readonly employer: string;
  readonly title?: string;
  readonly description?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly isCurrent: boolean;
  readonly location?: Location;
  readonly skills: readonly Skill[];
}

/**
 * Creates immutable experience data with collection defaults.
 */
export function createExperience(
  input: Omit<Experience, 'id' | 'provenance' | 'confidence' | 'skills'> &
    Partial<Pick<Experience, 'id' | 'provenance' | 'confidence' | 'skills'>>,
): Experience {
  return Object.freeze({
    id: input.id ?? randomUUID(),
    employer: input.employer,
    title: input.title,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate,
    isCurrent: input.isCurrent ?? false,
    location: input.location,
    skills: Object.freeze([...(input.skills ?? [])]),
    provenance: Object.freeze([...(input.provenance ?? [])]),
    confidence: Object.freeze([...(input.confidence ?? [])]),
  });
}
