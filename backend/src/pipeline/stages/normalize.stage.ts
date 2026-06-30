import { z } from 'zod';
import logger from '../../logger';
import { NormalizationError, UnsupportedNormalizationError } from '../../errors';
import { createContactInfo } from '../../models/contact-info';
import { createEducation } from '../../models/education';
import { createExperience } from '../../models/experience';
import { createLocation } from '../../models/location';
import { createNormalizedPartialCandidate } from '../../models/normalized-partial-candidate';
import { createSkill } from '../../models/skill';
import { createSocialLink } from '../../models/social-link';
import type { ContactInfo } from '../../models/contact-info';
import type { Education } from '../../models/education';
import type { Experience } from '../../models/experience';
import type { Location } from '../../models/location';
import type { NormalizationOperation } from '../../models/normalization-operation';
import type { NormalizedPartialCandidate } from '../../models/normalized-partial-candidate';
import type { PartialCandidate } from '../../models/partial-candidate';
import type { Skill } from '../../models/skill';
import type { SocialLink } from '../../models/social-link';
import { NormalizerRegistry } from '../../normalizers/base/normalizer.registry';
import type { LLMRuntimeContext } from '../../llm/runtime';

const semanticNormalizationSchema = z
  .object({
    headline: z.string().min(1).optional(),
    employerAliases: z.record(z.string(), z.string()).default({}),
    skillAliases: z.record(z.string(), z.string()).default({}),
    rationale: z.string().optional(),
    evidence: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).default(0.5),
  })
  .strict();

type NormalizationAttempt = {
  value: string;
  operations: readonly NormalizationOperation[];
};

export class NormalizeStage {
  private readonly registry: NormalizerRegistry;

  constructor(registry = new NormalizerRegistry()) {
    this.registry = registry;
  }

  async execute(
    candidates: readonly PartialCandidate[],
    llmContext?: LLMRuntimeContext,
  ): Promise<readonly NormalizedPartialCandidate[]> {
    logger.info('normalization.started', {
      candidateCount: candidates.length,
    });

    const normalizedCandidates: NormalizedPartialCandidate[] = [];

    for (const candidate of candidates) {
      normalizedCandidates.push(
        await this.normalizeCandidate(candidate, llmContext),
      );
    }

    logger.info('normalization.finished', {
      candidateCount: normalizedCandidates.length,
    });

    return normalizedCandidates;
  }

  private normalizeCandidate(
    candidate: PartialCandidate,
    llmContext?: LLMRuntimeContext,
  ): Promise<NormalizedPartialCandidate> | NormalizedPartialCandidate {
    const operations: NormalizationOperation[] = [];

    const location = candidate.location
      ? this.normalizeLocation(candidate.location, operations)
      : undefined;

    const contactInfo = this.deduplicateContactInfo(
      candidate.contactInfo.map((contact) =>
        this.normalizeContactInfo(contact, operations),
      ),
    );

    const socialLinks = this.deduplicateSocialLinks(
      candidate.socialLinks.map((link) =>
        this.normalizeSocialLink(link, operations),
      ),
    );

    const skills = this.deduplicateSkills(
      candidate.skills.map((skill) => this.normalizeSkill(skill, operations)),
    );

    const experiences = candidate.experiences.map((experience) =>
      this.normalizeExperience(experience, operations),
    );

    const education = candidate.education.map((entry) =>
      this.normalizeEducation(entry, operations),
    );

    const normalizedCandidate = createNormalizedPartialCandidate({
      sourceRecords: candidate.sourceRecords,
      firstName: this.normalizeFreeText(candidate.firstName),
      middleName: this.normalizeFreeText(candidate.middleName),
      lastName: this.normalizeFreeText(candidate.lastName),
      fullName: this.normalizeFreeText(candidate.fullName),
      headline: this.normalizeFreeText(candidate.headline),
      summary: this.normalizeFreeText(candidate.summary),
      location,
      contactInfo,
      socialLinks,
      experiences,
      education,
      skills,
      tags: this.deduplicateStrings(candidate.tags.map((tag) => this.normalizeFreeText(tag) ?? tag)),
      additionalData: candidate.additionalData,
      normalizationOperations: operations,
    });

    return this.applySemanticNormalization(
      normalizedCandidate,
      operations,
      llmContext,
    );
  }

  private normalizeContactInfo(
    contact: ContactInfo,
    operations: NormalizationOperation[],
  ): ContactInfo {
    const field =
      contact.kind === 'email'
        ? 'contactInfo.email'
        : contact.kind === 'phone'
          ? 'contactInfo.phone'
          : undefined;

    const value = field
      ? this.tryNormalize(field, contact.value)
      : { value: contact.value, operations: [] };

    operations.push(...value.operations);

    return createContactInfo({
      ...contact,
      value: value.value,
    });
  }

  private normalizeSocialLink(
    socialLink: SocialLink,
    operations: NormalizationOperation[],
  ): SocialLink {
    const normalized = this.tryNormalize('socialLink.url', socialLink.url);
    operations.push(...normalized.operations);

    return createSocialLink({
      ...socialLink,
      url: normalized.value,
      username: socialLink.username
        ? this.normalizeFreeText(socialLink.username)
        : socialLink.username,
    });
  }

  private normalizeSkill(
    skill: Skill,
    operations: NormalizationOperation[],
  ): Skill {
    const normalized = this.tryNormalize('skill.name', skill.name);
    operations.push(...normalized.operations);

    return createSkill({
      ...skill,
      name: normalized.value,
      category: this.normalizeFreeText(skill.category),
    });
  }

  private normalizeLocation(
    location: Location,
    operations: NormalizationOperation[],
  ): Location {
    const city = location.city
      ? this.tryNormalize('location.city', location.city)
      : undefined;
    const region = location.region
      ? this.tryNormalize('location.region', location.region)
      : undefined;
    const country = location.country
      ? this.tryNormalize('location.country', location.country)
      : undefined;
    const formatted = location.formatted
      ? this.tryNormalize('location.formatted', location.formatted)
      : undefined;

    operations.push(
      ...(city?.operations ?? []),
      ...(region?.operations ?? []),
      ...(country?.operations ?? []),
      ...(formatted?.operations ?? []),
    );

    return createLocation({
      ...location,
      raw: this.normalizeFreeText(location.raw),
      city: city?.value,
      region: region?.value,
      country: country?.value,
      postalCode: this.normalizeFreeText(location.postalCode),
      formatted: formatted?.value,
    });
  }

  private normalizeExperience(
    experience: Experience,
    operations: NormalizationOperation[],
  ): Experience {
    const employer = this.tryNormalize('experience.employer', experience.employer);
    const startDate = experience.startDate
      ? this.tryNormalize('experience.startDate', experience.startDate)
      : undefined;
    const endDate = experience.endDate
      ? this.tryNormalize('experience.endDate', experience.endDate)
      : undefined;

    operations.push(
      ...employer.operations,
      ...(startDate?.operations ?? []),
      ...(endDate?.operations ?? []),
    );

    return createExperience({
      ...experience,
      employer: employer.value,
      title: this.normalizeFreeText(experience.title),
      description: this.normalizeFreeText(experience.description),
      startDate: startDate?.value,
      endDate: endDate?.value,
      location: experience.location
        ? this.normalizeLocation(experience.location, operations)
        : undefined,
      skills: this.deduplicateSkills(
        experience.skills.map((skill) => this.normalizeSkill(skill, operations)),
      ),
    });
  }

  private normalizeEducation(
    education: Education,
    operations: NormalizationOperation[],
  ): Education {
    const institution = this.tryNormalize(
      'education.institution',
      education.institution,
    );
    const degree = education.degree
      ? this.tryNormalize('education.degree', education.degree)
      : undefined;
    const startDate = education.startDate
      ? this.tryNormalize('education.startDate', education.startDate)
      : undefined;
    const endDate = education.endDate
      ? this.tryNormalize('education.endDate', education.endDate)
      : undefined;

    operations.push(
      ...institution.operations,
      ...(degree?.operations ?? []),
      ...(startDate?.operations ?? []),
      ...(endDate?.operations ?? []),
    );

    return createEducation({
      ...education,
      institution: institution.value,
      degree: degree?.value,
      fieldOfStudy: this.normalizeFreeText(education.fieldOfStudy),
      grade: this.normalizeFreeText(education.grade),
      startDate: startDate?.value,
      endDate: endDate?.value,
      location: education.location
        ? this.normalizeLocation(education.location, operations)
        : undefined,
    });
  }

  private tryNormalize(field: string, value: string): NormalizationAttempt {
    try {
      const normalizer = this.registry.resolve(field);
      const result = normalizer.normalize(value, {
        field,
        timestamp: new Date().toISOString(),
      });

      if (!normalizer.validate(result.value)) {
        logger.warn('normalization.invalid.result', {
          field,
          normalizer: normalizer.name,
        });

        return {
          value,
          operations: [],
        };
      }

      logger.debug('normalization.field.normalized', {
        field,
        normalizer: normalizer.name,
      });

      return {
        value: result.value,
        operations: result.operation ? [result.operation] : [],
      };
    } catch (error) {
      if (
        error instanceof UnsupportedNormalizationError ||
        error instanceof NormalizationError
      ) {
        logger.warn('normalization.field.skipped', {
          field,
          normalizer:
            error instanceof NormalizationError
              ? error.normalizer
              : 'NormalizerRegistry',
          recoverable:
            error instanceof NormalizationError ? error.recoverable : true,
        });

        return {
          value,
          operations: [],
        };
      }

      throw error;
    }
  }

  private normalizeFreeText(value: string | undefined): string | undefined {
    if (value === undefined) {
      return value;
    }

    const normalized = Array.from(value)
      .filter((character) => character.charCodeAt(0) >= 32)
      .join('')
      .trim()
      .replace(/\s+/g, ' ');
    return normalized || undefined;
  }

  private async applySemanticNormalization(
    candidate: NormalizedPartialCandidate,
    operations: NormalizationOperation[],
    llmContext?: LLMRuntimeContext,
  ): Promise<NormalizedPartialCandidate> {
    if (!llmContext?.isEnabledFor('normalization')) {
      return candidate;
    }

    const response = await llmContext.orchestrator.runJson({
      stage: 'normalization',
      responseSchema: semanticNormalizationSchema,
      input: candidate,
      prompt: [
        'Normalize ambiguous candidate semantics without inventing unsupported values.',
        'Only canonicalize titles, company names, and skills when the mapping is strongly grounded in the input.',
        JSON.stringify(candidate),
      ].join('\n\n'),
    });

    if (!response.ok) {
      return candidate;
    }

    llmContext.recordDecision(response.envelope);

    const normalizedSkills = candidate.skills.map((skill) => {
      const canonical = response.data.skillAliases[skill.name];

      if (!canonical || canonical.trim().length === 0) {
        return skill;
      }

      operations.push({
        field: 'skill.name',
        normalizer: 'LLMSemanticNormalizer',
        originalValue: skill.name,
        normalizedValue: canonical,
        timestamp: new Date().toISOString(),
      });

      return createSkill({
        ...skill,
        name: canonical,
      });
    });

    const normalizedExperiences = candidate.experiences.map((experience) => {
      const canonicalEmployer = response.data.employerAliases[experience.employer];

      if (!canonicalEmployer || canonicalEmployer.trim().length === 0) {
        return experience;
      }

      operations.push({
        field: 'experience.employer',
        normalizer: 'LLMSemanticNormalizer',
        originalValue: experience.employer,
        normalizedValue: canonicalEmployer,
        timestamp: new Date().toISOString(),
      });

      return createExperience({
        ...experience,
        employer: canonicalEmployer,
      });
    });

    return createNormalizedPartialCandidate({
      ...candidate,
      headline: response.data.headline ?? candidate.headline,
      skills: normalizedSkills,
      experiences: normalizedExperiences,
      normalizationOperations: operations,
    });
  }

  private deduplicateStrings(values: readonly string[]): readonly string[] {
    return Object.freeze([...new Set(values.filter(Boolean))]);
  }

  private deduplicateSkills(skills: readonly Skill[]): readonly Skill[] {
    const seen = new Set<string>();
    const result: Skill[] = [];

    for (const skill of skills) {
      const key = skill.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(skill);
      }
    }

    return Object.freeze(result);
  }

  private deduplicateSocialLinks(
    socialLinks: readonly SocialLink[],
  ): readonly SocialLink[] {
    const seen = new Set<string>();
    const result: SocialLink[] = [];

    for (const socialLink of socialLinks) {
      const key = `${socialLink.platform}:${socialLink.url.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(socialLink);
      }
    }

    return Object.freeze(result);
  }

  private deduplicateContactInfo(
    contactInfo: readonly ContactInfo[],
  ): readonly ContactInfo[] {
    const seen = new Set<string>();
    const result: ContactInfo[] = [];

    for (const contact of contactInfo) {
      const key = `${contact.kind}:${contact.value.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(contact);
      }
    }

    return Object.freeze(result);
  }
}
