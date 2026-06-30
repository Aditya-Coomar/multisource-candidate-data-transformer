import { randomUUID } from 'node:crypto';
import type {
  ConfidenceCarrier,
  IdentifiableEntity,
  ProvenanceCarrier,
} from '../interfaces/base-entity.interface';

/**
 * Canonical skill entry used across normalization and projection.
 */
export interface Skill
  extends IdentifiableEntity,
    ProvenanceCarrier,
    ConfidenceCarrier {
  readonly name: string;
  readonly category?: string;
  readonly level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  readonly yearsOfExperience?: number;
}

/**
 * Creates immutable skill data.
 */
export function createSkill(
  input: Omit<Skill, 'id' | 'provenance' | 'confidence'> &
    Partial<Pick<Skill, 'id' | 'provenance' | 'confidence'>>,
): Skill {
  return Object.freeze({
    id: input.id ?? randomUUID(),
    name: input.name,
    category: input.category,
    level: input.level,
    yearsOfExperience: input.yearsOfExperience,
    provenance: Object.freeze([...(input.provenance ?? [])]),
    confidence: Object.freeze([...(input.confidence ?? [])]),
  });
}
