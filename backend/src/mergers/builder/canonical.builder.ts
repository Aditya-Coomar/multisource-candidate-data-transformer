import { CanonicalBuildError } from '../../errors';
import { createCanonicalCandidate, createLocation } from '../../models';
import type { CanonicalCandidate, Location } from '../../models';
import {
  createDeterministicId,
  getEarliestSourceTimestamp,
  getLatestSourceTimestamp,
  mergeUniqueConfidence,
  mergeUniqueProvenance,
  remapConfidenceScores,
  remapProvenanceRecords,
  serializeMergeValue,
} from '../base/merge.context';
import type { MergeContext } from '../base/merge.context';
import type { MergeResolvedFields, ResolvedField } from '../base/merge.types';

export class CanonicalBuilder {
  build(
    context: MergeContext,
    resolvedFields: MergeResolvedFields,
  ): CanonicalCandidate {
    if (context.currentGroup.sourceRecords.length === 0) {
      throw new CanonicalBuildError('Cannot build a canonical candidate without sources.', {
        groupId: context.currentGroup.groupId,
        reason: 'missing-source-records',
        sourceIds: [],
      });
    }

    const sourceRecords = context.currentGroup.sourceRecords;
    const provenance = mergeUniqueProvenance(
      this.collectResolvedProvenance(resolvedFields),
    );
    const location = this.buildLocation(context, resolvedFields.location);

    return createCanonicalCandidate({
      id: createDeterministicId('canonical-candidate', [
        context.currentGroup.groupId,
      ]),
      firstName: resolvedFields.firstName?.value as string | undefined,
      middleName: resolvedFields.middleName?.value as string | undefined,
      lastName: resolvedFields.lastName?.value as string | undefined,
      fullName: resolvedFields.fullName?.value as string | undefined,
      headline: resolvedFields.headline?.value as string | undefined,
      summary: resolvedFields.summary?.value as string | undefined,
      location,
      contactInfo:
        (resolvedFields.contactInfo?.value as CanonicalCandidate['contactInfo']) ?? [],
      socialLinks:
        (resolvedFields.socialLinks?.value as CanonicalCandidate['socialLinks']) ?? [],
      experiences:
        (resolvedFields.experiences?.value as CanonicalCandidate['experiences']) ?? [],
      education:
        (resolvedFields.education?.value as CanonicalCandidate['education']) ?? [],
      skills: (resolvedFields.skills?.value as CanonicalCandidate['skills']) ?? [],
      tags: (resolvedFields.tags?.value as CanonicalCandidate['tags']) ?? [],
      additionalData:
        (resolvedFields.additionalData?.value as CanonicalCandidate['additionalData']) ?? {},
      sourceRecords,
      provenance,
      confidence: Object.freeze([]),
      createdAt: getEarliestSourceTimestamp(sourceRecords),
      updatedAt: getLatestSourceTimestamp(sourceRecords),
    });
  }

  private collectResolvedProvenance(
    resolvedFields: MergeResolvedFields,
  ): ReadonlyArray<CanonicalCandidate['provenance']> {
    const provenance: CanonicalCandidate['provenance'][] = [];

    for (const key of Object.keys(resolvedFields)) {
      const resolvedField = resolvedFields[key as keyof MergeResolvedFields];
      if (resolvedField?.provenance?.length) {
        provenance.push(resolvedField.provenance);
      }
    }

    return Object.freeze(provenance);
  }

  private buildLocation(
    context: MergeContext,
    resolvedField: ResolvedField | undefined,
  ): Location | undefined {
    const location = resolvedField?.value as Location | undefined;

    if (!location) {
      return undefined;
    }

    const remappedProvenance = remapProvenanceRecords(
      location.provenance as readonly unknown[],
      context.currentGroup.sourceRecordIdMap,
    );
    const remappedConfidence = remapConfidenceScores(
      location.confidence as readonly unknown[],
      context.currentGroup.sourceRecordIdMap,
    );

    try {
      return createLocation({
        ...location,
        id: createDeterministicId('location', [
          context.currentGroup.groupId,
          serializeMergeValue(location),
        ]),
        provenance: mergeUniqueProvenance([
          remappedProvenance,
          resolvedField?.provenance ?? [],
        ]),
        confidence: mergeUniqueConfidence([remappedConfidence]),
      });
    } catch (error) {
      throw new CanonicalBuildError('Failed to construct canonical location.', {
        groupId: context.currentGroup.groupId,
        field: 'location',
        reason: 'location-build-failure',
        sourceIds: context.mergePlan.allSourceRecordIds,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
