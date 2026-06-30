import { randomUUID } from 'node:crypto';
import type { CandidateAggregate } from '../interfaces/candidate.interface';
import type { CandidateMetadata } from './candidate-metadata';
import type { ContactInfo } from './contact-info';
import type { Education } from './education';
import type { Experience } from './experience';
import type { Location } from './location';
import type { Skill } from './skill';
import type { SocialLink } from './social-link';

/**
 * Canonical internal source of truth for a candidate across all sources.
 */
export interface CanonicalCandidate extends CandidateAggregate {
  readonly firstName?: string;
  readonly middleName?: string;
  readonly lastName?: string;
  readonly fullName?: string;
  readonly headline?: string;
  readonly summary?: string;
  readonly location?: Location;
  readonly contactInfo: readonly ContactInfo[];
  readonly socialLinks: readonly SocialLink[];
  readonly experiences: readonly Experience[];
  readonly education: readonly Education[];
  readonly skills: readonly Skill[];
  readonly tags: readonly string[];
  readonly additionalData: Readonly<Record<string, unknown>>;
  readonly candidateMetadata?: CandidateMetadata;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Creates a canonical candidate with deterministic collection defaults.
 */
export function createCanonicalCandidate(
  input: Partial<CanonicalCandidate> = {},
): CanonicalCandidate {
  const timestamp = new Date().toISOString();

  return Object.freeze({
    id: input.id ?? randomUUID(),
    firstName: input.firstName,
    middleName: input.middleName,
    lastName: input.lastName,
    fullName: input.fullName,
    headline: input.headline,
    summary: input.summary,
    location: input.location,
    contactInfo: Object.freeze([...(input.contactInfo ?? [])]),
    socialLinks: Object.freeze([...(input.socialLinks ?? [])]),
    experiences: Object.freeze([...(input.experiences ?? [])]),
    education: Object.freeze([...(input.education ?? [])]),
    skills: Object.freeze([...(input.skills ?? [])]),
    sourceRecords: Object.freeze([...(input.sourceRecords ?? [])]),
    provenance: Object.freeze([...(input.provenance ?? [])]),
    confidence: Object.freeze([...(input.confidence ?? [])]),
    tags: Object.freeze([...(input.tags ?? [])]),
    additionalData: Object.freeze({ ...(input.additionalData ?? {}) }),
    candidateMetadata: input.candidateMetadata,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  });
}
