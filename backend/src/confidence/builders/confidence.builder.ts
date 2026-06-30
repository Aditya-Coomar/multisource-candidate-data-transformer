import {
  createCandidateMetadata,
  createCanonicalCandidate,
  createContactInfo,
  createEducation,
  createExperience,
  createLocation,
  createSkill,
  createSocialLink,
} from '../../models';
import type {
  CanonicalCandidate,
  ConfidenceScore,
  ContactInfo,
  Education,
  Experience,
  Location,
  Skill,
  SocialLink,
} from '../../models';
import {
  createDeterministicId,
  mergeUniqueConfidence,
} from '../../mergers/base/merge.context';
import type { ConfidenceContext } from '../base/confidence.context';
import type { FieldConfidenceResult } from '../base/confidence.types';
import { CONFIDENCE_TOP_LEVEL_FIELDS } from '../base/confidence.types';
import { FieldCalculator } from '../calculators/field.calculator';
import { OverallCalculator } from '../calculators/overall.calculator';
import { WeightedStrategy } from '../strategies/weighted.strategy';
import { ProvenanceBuilder } from '../../provenance/builders/provenance.builder';

export class ConfidenceBuilder {
  private readonly fieldCalculator = new FieldCalculator(new WeightedStrategy());
  private readonly overallCalculator = new OverallCalculator();
  private readonly provenanceBuilder = new ProvenanceBuilder();

  build(context: ConfidenceContext): CanonicalCandidate {
    const fieldResults = CONFIDENCE_TOP_LEVEL_FIELDS.map((fieldPath) =>
      this.fieldCalculator.calculate(
        fieldPath,
        context.input.candidate[fieldPath],
        context,
      ),
    );
    const candidateProvenance = this.provenanceBuilder.buildCandidateProvenance(
      context,
    );
    const location = this.buildLocation(context, fieldResults);
    const contactInfo = this.buildContactInfo(context);
    const socialLinks = this.buildSocialLinks(context);
    const skills = this.buildSkills(context);
    const experiences = this.buildExperiences(context);
    const education = this.buildEducation(context);
    const overallConfidence = this.overallCalculator.calculate(
      fieldResults,
      context,
    );

    return createCanonicalCandidate({
      ...context.input.candidate,
      location,
      contactInfo,
      socialLinks,
      skills,
      experiences,
      education,
      provenance: candidateProvenance,
      confidence: Object.freeze([
        ...fieldResults.map((result) => result.confidence),
        overallConfidence,
      ]),
      candidateMetadata: createCandidateMetadata({
        candidateId: context.input.candidate.id,
        pipelineVersion: context.config.pipelineVersion,
        engineVersion: context.config.engineVersion,
        mergeStrategyVersion: context.config.mergeStrategyVersion,
        processingStartedAt: context.processingStartedAt,
        processingCompletedAt: context.processingCompletedAt,
        processingDurationMs: context.processingDurationMs,
        mergedSources: context.input.candidate.sourceRecords.map(
          (sourceRecord) => sourceRecord.sourceName,
        ),
        totalSources: context.input.candidate.sourceRecords.length,
        totalFields: CONFIDENCE_TOP_LEVEL_FIELDS.length,
      }),
    });
  }

  private buildLocation(
    context: ConfidenceContext,
    fieldResults: readonly FieldConfidenceResult[],
  ): Location | undefined {
    const location = context.input.candidate.location;

    if (!location) {
      return undefined;
    }

    const locationConfidence =
      fieldResults.find((result) => result.fieldPath === 'location')?.confidence;

    return createLocation({
      ...location,
      id: createDeterministicId('confidence-location', [context.input.candidate.id]),
      provenance: this.provenanceBuilder.attachEntityProvenance(
        location,
        'location',
        location,
        context,
      ),
      confidence: locationConfidence ? [locationConfidence] : [],
    });
  }

  private buildContactInfo(context: ConfidenceContext): readonly ContactInfo[] {
    return Object.freeze(
      context.input.candidate.contactInfo.map((contact, index) =>
        createContactInfo({
          ...contact,
          id: createDeterministicId('confidence-contact', [
            context.input.candidate.id,
            String(index),
            contact.kind,
            contact.value,
          ]),
          provenance: this.provenanceBuilder.attachEntityProvenance(
            contact,
            `contactInfo.${contact.kind}:${contact.value.toLowerCase()}`,
            contact.value,
            context,
          ),
          confidence: this.createEntityConfidence(
            `contactInfo.${index}`,
            contact.value,
            context,
            contact.confidence as readonly ConfidenceScore[],
          ),
        }),
      ),
    );
  }

  private buildSocialLinks(context: ConfidenceContext): readonly SocialLink[] {
    return Object.freeze(
      context.input.candidate.socialLinks.map((socialLink, index) =>
        createSocialLink({
          ...socialLink,
          id: createDeterministicId('confidence-social', [
            context.input.candidate.id,
            String(index),
            socialLink.platform,
            socialLink.url,
          ]),
          provenance: this.provenanceBuilder.attachEntityProvenance(
            socialLink,
            `socialLinks.${socialLink.platform}:${socialLink.url.toLowerCase()}`,
            socialLink.url,
            context,
          ),
          confidence: this.createEntityConfidence(
            `socialLinks.${index}`,
            socialLink.url,
            context,
            socialLink.confidence as readonly ConfidenceScore[],
          ),
        }),
      ),
    );
  }

  private buildSkills(context: ConfidenceContext): readonly Skill[] {
    return Object.freeze(
      context.input.candidate.skills.map((skill, index) =>
        createSkill({
          ...skill,
          id: createDeterministicId('confidence-skill', [
            context.input.candidate.id,
            String(index),
            skill.name,
          ]),
          provenance: this.provenanceBuilder.attachEntityProvenance(
            skill,
            `skills.${skill.name.toLowerCase()}`,
            skill.name,
            context,
          ),
          confidence: this.createEntityConfidence(
            `skills.${index}`,
            skill.name,
            context,
            skill.confidence as readonly ConfidenceScore[],
          ),
        }),
      ),
    );
  }

  private buildExperiences(context: ConfidenceContext): readonly Experience[] {
    return Object.freeze(
      context.input.candidate.experiences.map((experience, index) =>
        createExperience({
          ...experience,
          id: createDeterministicId('confidence-experience', [
            context.input.candidate.id,
            String(index),
            experience.employer,
            experience.title ?? '',
          ]),
          skills: Object.freeze(
            experience.skills.map((skill, skillIndex) =>
              createSkill({
                ...skill,
                id: createDeterministicId('confidence-experience-skill', [
                  context.input.candidate.id,
                  String(index),
                  String(skillIndex),
                  skill.name,
                ]),
                provenance: this.provenanceBuilder.attachEntityProvenance(
                  skill,
                  `experiences.${index}.skills.${skill.name.toLowerCase()}`,
                  skill.name,
                  context,
                ),
                confidence: this.createEntityConfidence(
                  `experiences.${index}.skills.${skillIndex}`,
                  skill.name,
                  context,
                  skill.confidence as readonly ConfidenceScore[],
                ),
              }),
            ),
          ),
          provenance: this.provenanceBuilder.attachEntityProvenance(
            experience,
            `experiences.${index}`,
            `${experience.employer}|${experience.title ?? ''}`,
            context,
          ),
          confidence: this.createEntityConfidence(
            `experiences.${index}`,
            `${experience.employer}|${experience.title ?? ''}`,
            context,
            experience.confidence as readonly ConfidenceScore[],
          ),
        }),
      ),
    );
  }

  private buildEducation(context: ConfidenceContext): readonly Education[] {
    return Object.freeze(
      context.input.candidate.education.map((education, index) =>
        createEducation({
          ...education,
          id: createDeterministicId('confidence-education', [
            context.input.candidate.id,
            String(index),
            education.institution,
            education.degree ?? '',
          ]),
          provenance: this.provenanceBuilder.attachEntityProvenance(
            education,
            `education.${index}`,
            `${education.institution}|${education.degree ?? ''}`,
            context,
          ),
          confidence: this.createEntityConfidence(
            `education.${index}`,
            `${education.institution}|${education.degree ?? ''}`,
            context,
            education.confidence as readonly ConfidenceScore[],
          ),
        }),
      ),
    );
  }

  private createEntityConfidence(
    fieldPath: string,
    value: unknown,
    context: ConfidenceContext,
    existing: readonly ConfidenceScore[],
  ): readonly ConfidenceScore[] {
    const result = this.fieldCalculator.calculate(fieldPath, value, context);
    return mergeUniqueConfidence([existing, [result.confidence]]);
  }
}
