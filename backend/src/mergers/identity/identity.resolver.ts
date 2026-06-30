import { IdentityResolutionError } from '../../errors';
import type { NormalizedPartialCandidate } from '../../models';
import {
  getCandidateDisplayName,
  getCandidatePrimaryEmployer,
  getLocationFingerprint,
  normalizeIdentityValue,
} from '../base/merge.context';
import type { CandidateIdentity, MergeConfig } from '../base/merge.types';

export class IdentityResolver {
  constructor(private readonly config: MergeConfig) {}

  resolve(candidate: NormalizedPartialCandidate): CandidateIdentity {
    if (candidate.sourceRecords.length === 0) {
      throw new IdentityResolutionError(
        'Cannot resolve candidate identity without source records.',
        {
          groupId: 'identity-resolution',
          reason: 'missing-source-records',
          sourceIds: [],
        },
      );
    }

    const keys: string[] = [];
    const matchedBy: string[] = [];
    const seen = new Set<string>();

    for (const contact of candidate.contactInfo) {
      if (contact.kind === 'email') {
        this.addIdentityKey(
          keys,
          matchedBy,
          seen,
          'email',
          normalizeIdentityValue(contact.value),
        );
      }

      if (contact.kind === 'phone') {
        this.addIdentityKey(
          keys,
          matchedBy,
          seen,
          'phone',
          normalizeIdentityValue(contact.value),
        );
      }
    }

    for (const socialLink of candidate.socialLinks) {
      if (
        socialLink.platform === 'github' ||
        socialLink.url.toLowerCase().includes('github.com')
      ) {
        this.addIdentityKey(
          keys,
          matchedBy,
          seen,
          'github',
          normalizeIdentityValue(socialLink.url),
        );
      }

      if (
        socialLink.platform === 'linkedin' ||
        socialLink.url.toLowerCase().includes('linkedin.com')
      ) {
        this.addIdentityKey(
          keys,
          matchedBy,
          seen,
          'linkedin',
          normalizeIdentityValue(socialLink.url),
        );
      }
    }

    if (this.config.identityFallbackEnabled) {
      const fullName = normalizeIdentityValue(getCandidateDisplayName(candidate));
      const employer = normalizeIdentityValue(getCandidatePrimaryEmployer(candidate));
      const location = normalizeIdentityValue(
        getLocationFingerprint(candidate.location),
      );

      if (fullName && employer && location) {
        this.addIdentityKey(
          keys,
          matchedBy,
          seen,
          'fallback',
          `${fullName}|${employer}|${location}`,
        );
      }
    }

    return Object.freeze({
      keys: Object.freeze(keys),
      matchedBy: Object.freeze(matchedBy),
    });
  }

  private addIdentityKey(
    keys: string[],
    matchedBy: string[],
    seen: Set<string>,
    kind: string,
    value: string | undefined,
  ): void {
    if (!value) {
      return;
    }

    const key = `${kind}:${value}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    keys.push(key);
    matchedBy.push(kind);
  }
}
