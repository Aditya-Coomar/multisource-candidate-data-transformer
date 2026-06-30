import { ZodType } from 'zod';
import logger from '../logger';
import {
  candidateMetadataSchema,
  canonicalCandidateSchema,
  confidenceScoreSchema,
  contactInfoSchema,
  educationSchema,
  experienceSchema,
  locationSchema,
  normalizedPartialCandidateSchema,
  partialCandidateSchema,
  projectionConfigSchema,
  provenanceSchema,
  skillSchema,
  socialLinkSchema,
  sourceRecordSchema,
} from '../types/schemas';
import type {
  CandidateMetadata,
  CanonicalCandidate,
  ConfidenceScore,
  ContactInfo,
  Education,
  Experience,
  Location,
  NormalizedPartialCandidate,
  PartialCandidate,
  ProjectionConfig,
  Provenance,
  Skill,
  SocialLink,
  SourceRecord,
} from '../models';

function validateSchema<T>(
  schema: ZodType<T>,
  payload: unknown,
  schemaName: string,
): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    logger.error('domain.validation.failed', {
      schemaName,
      issues: result.error.flatten(),
    });
    throw result.error;
  }

  return result.data;
}

export function validateCanonicalCandidate(
  payload: unknown,
): CanonicalCandidate {
  return validateSchema(
    canonicalCandidateSchema,
    payload,
    'CanonicalCandidate',
  );
}

export function validateCandidateMetadata(payload: unknown): CandidateMetadata {
  return validateSchema(
    candidateMetadataSchema,
    payload,
    'CandidateMetadata',
  );
}

export function validatePartialCandidate(payload: unknown): PartialCandidate {
  return validateSchema(partialCandidateSchema, payload, 'PartialCandidate');
}

export function validateNormalizedPartialCandidate(
  payload: unknown,
): NormalizedPartialCandidate {
  return validateSchema(
    normalizedPartialCandidateSchema,
    payload,
    'NormalizedPartialCandidate',
  );
}

export function validateContactInfo(payload: unknown): ContactInfo {
  return validateSchema(contactInfoSchema, payload, 'ContactInfo');
}

export function validateExperience(payload: unknown): Experience {
  return validateSchema(experienceSchema, payload, 'Experience');
}

export function validateEducation(payload: unknown): Education {
  return validateSchema(educationSchema, payload, 'Education');
}

export function validateSkill(payload: unknown): Skill {
  return validateSchema(skillSchema, payload, 'Skill');
}

export function validateLocation(payload: unknown): Location {
  return validateSchema(locationSchema, payload, 'Location');
}

export function validateSocialLink(payload: unknown): SocialLink {
  return validateSchema(socialLinkSchema, payload, 'SocialLink');
}

export function validateSourceRecord(payload: unknown): SourceRecord {
  return validateSchema(sourceRecordSchema, payload, 'SourceRecord');
}

export function validateProvenance(payload: unknown): Provenance {
  return validateSchema(provenanceSchema, payload, 'Provenance');
}

export function validateConfidenceScore(payload: unknown): ConfidenceScore {
  return validateSchema(
    confidenceScoreSchema,
    payload,
    'ConfidenceScore',
  );
}

export function validateProjectionConfig(payload: unknown): ProjectionConfig {
  return validateSchema(
    projectionConfigSchema,
    payload,
    'ProjectionConfig',
  );
}
