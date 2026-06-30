import type { ContactInfo } from './contact-info';
import type { Education } from './education';
import type { Experience } from './experience';
import type { Location } from './location';
import type { Skill } from './skill';
import type { SocialLink } from './social-link';
import type { SourceRecord } from './source-record';

/**
 * Sparse candidate payload produced by source-specific extractors.
 */
export interface PartialCandidate
{
  readonly sourceRecords: readonly SourceRecord[];
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
}

/**
 * Creates a sparse candidate while preserving intentionally missing fields.
 */
export function createPartialCandidate(
  input: Partial<PartialCandidate> = {},
): PartialCandidate {
  return Object.freeze({
    sourceRecords: Object.freeze([...(input.sourceRecords ?? [])]),
    ...(input.firstName !== undefined && { firstName: input.firstName }),
    ...(input.middleName !== undefined && { middleName: input.middleName }),
    ...(input.lastName !== undefined && { lastName: input.lastName }),
    ...(input.fullName !== undefined && { fullName: input.fullName }),
    ...(input.headline !== undefined && { headline: input.headline }),
    ...(input.summary !== undefined && { summary: input.summary }),
    ...(input.location !== undefined && { location: input.location }),
    contactInfo: Object.freeze([...(input.contactInfo ?? [])]),
    socialLinks: Object.freeze([...(input.socialLinks ?? [])]),
    experiences: Object.freeze([...(input.experiences ?? [])]),
    education: Object.freeze([...(input.education ?? [])]),
    skills: Object.freeze([...(input.skills ?? [])]),
    tags: Object.freeze([...(input.tags ?? [])]),
    additionalData: Object.freeze({ ...(input.additionalData ?? {}) }),
  });
}
