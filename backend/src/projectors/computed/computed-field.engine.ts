import type { CanonicalCandidate } from '../../models';
import { ComputedFieldError } from '../../errors';

const DEGREE_RANKS = [
  'phd',
  'doctor',
  'doctorate',
  'master',
  'mba',
  'bachelor',
  'b.tech',
  'ba',
  'bs',
  'associate',
  'diploma',
];

export class ComputedFieldEngine {
  compute(candidate: CanonicalCandidate, fieldName: string): unknown {
    try {
      switch (fieldName) {
        case 'primary_email':
          return this.getPrimaryContact(candidate, 'email');
        case 'primary_phone':
          return this.getPrimaryContact(candidate, 'phone');
        case 'skills_count':
          return candidate.skills.length;
        case 'experience_count':
          return candidate.experiences.length;
        case 'profile_completion':
          return this.getProfileCompletion(candidate);
        case 'highest_degree':
          return this.getHighestDegree(candidate);
        default:
          throw new ComputedFieldError(
            fieldName,
            'unsupported computed field',
          );
      }
    } catch (error) {
      if (error instanceof ComputedFieldError) {
        throw error;
      }

      throw new ComputedFieldError(
        fieldName,
        'unexpected computed field failure',
        error instanceof Error ? error : undefined,
      );
    }
  }

  private getPrimaryContact(
    candidate: CanonicalCandidate,
    kind: 'email' | 'phone',
  ): string | undefined {
    const exactMatch = candidate.contactInfo.find(
      (contact) => contact.kind === kind && contact.isPrimary,
    );

    if (exactMatch) {
      return exactMatch.value;
    }

    return candidate.contactInfo.find((contact) => contact.kind === kind)?.value;
  }

  private getProfileCompletion(candidate: CanonicalCandidate): number {
    const checks = [
      Boolean(candidate.fullName),
      Boolean(candidate.headline),
      Boolean(candidate.summary),
      Boolean(candidate.location),
      candidate.contactInfo.length > 0,
      candidate.experiences.length > 0,
      candidate.education.length > 0,
      candidate.skills.length > 0,
    ];

    const completed = checks.filter(Boolean).length;
    return Number((completed / checks.length).toFixed(2));
  }

  private getHighestDegree(candidate: CanonicalCandidate): string | undefined {
    const rankedEducation = candidate.education
      .map((entry) => entry.degree)
      .filter((degree): degree is string => Boolean(degree))
      .sort((left, right) => this.rankDegree(left) - this.rankDegree(right));

    return rankedEducation[0];
  }

  private rankDegree(degree: string): number {
    const normalized = degree.toLowerCase();
    const rank = DEGREE_RANKS.findIndex((entry) => normalized.includes(entry));
    return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
  }
}
