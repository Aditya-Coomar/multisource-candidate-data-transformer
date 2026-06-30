import { randomUUID } from 'node:crypto';
import type {
  ConfidenceCarrier,
  IdentifiableEntity,
  ProvenanceCarrier,
} from '../interfaces/base-entity.interface';

/**
 * Canonical social or portfolio link for a candidate.
 */
export interface SocialLink
  extends IdentifiableEntity,
    ProvenanceCarrier,
    ConfidenceCarrier {
  readonly platform:
    | 'linkedin'
    | 'github'
    | 'portfolio'
    | 'twitter'
    | 'other';
  readonly url: string;
  readonly username?: string;
}

/**
 * Creates immutable social-link data.
 */
export function createSocialLink(
  input: Omit<SocialLink, 'id' | 'provenance' | 'confidence'> &
    Partial<Pick<SocialLink, 'id' | 'provenance' | 'confidence'>>,
): SocialLink {
  return Object.freeze({
    id: input.id ?? randomUUID(),
    platform: input.platform,
    url: input.url,
    username: input.username,
    provenance: Object.freeze([...(input.provenance ?? [])]),
    confidence: Object.freeze([...(input.confidence ?? [])]),
  });
}
