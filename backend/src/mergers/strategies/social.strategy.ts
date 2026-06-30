import { createSocialLink } from '../../models';
import type { ConfidenceScore, Provenance, SocialLink } from '../../models';
import {
  calculateValueCompleteness,
  choosePreferredCandidate,
  createDeterministicId,
  createFieldDecisionProvenance,
  mergeUniqueConfidence,
  mergeUniqueProvenance,
  mergeUniqueSourceRecordIds,
  remapConfidenceScores,
  remapProvenanceRecords,
  serializeMergeValue,
} from '../base/merge.context';
import type { MergeStrategy } from '../base/merge.interface';
import type { MergeContext } from '../base/merge.context';
import type { MergeFieldCandidate, MergeFieldPlan, ResolvedField } from '../base/merge.types';

type SocialBucket = {
  representative: MergeFieldCandidate<SocialLink>;
  sourceRecordIds: readonly string[];
  provenanceLists: readonly (readonly Provenance[])[];
  confidenceLists: readonly (readonly ConfidenceScore[])[];
  discardedValues: readonly string[];
};

export class SocialMergeStrategy implements MergeStrategy {
  public readonly name = 'social';

  merge(fieldPlan: MergeFieldPlan, context: MergeContext): ResolvedField {
    const buckets = new Map<string, SocialBucket>();
    const orderedKeys: string[] = [];
    const candidateSourceRecordIds = mergeUniqueSourceRecordIds(
      fieldPlan.candidates.map((candidate) => candidate.sourceRecordIds),
    );

    for (const candidate of fieldPlan.candidates) {
      for (const socialLink of candidate.value as readonly SocialLink[]) {
        const itemCandidate = Object.freeze({
          ...candidate,
          value: socialLink,
          completenessScore: calculateValueCompleteness(socialLink),
        });
        const key = `${socialLink.platform}:${socialLink.url.toLowerCase()}`;
        const remappedProvenance = remapProvenanceRecords(
          socialLink.provenance,
          context.currentGroup.sourceRecordIdMap,
        );
        const remappedConfidence = remapConfidenceScores(
          socialLink.confidence,
          context.currentGroup.sourceRecordIdMap,
        );
        const existingBucket = buckets.get(key);

        if (!existingBucket) {
          buckets.set(
            key,
            Object.freeze({
              representative: itemCandidate,
              sourceRecordIds: itemCandidate.sourceRecordIds,
              provenanceLists: Object.freeze([remappedProvenance]),
              confidenceLists: Object.freeze([remappedConfidence]),
              discardedValues: Object.freeze([]),
            }),
          );
          orderedKeys.push(key);
          continue;
        }

        const nextRepresentative = choosePreferredCandidate(
          existingBucket.representative,
          itemCandidate,
        ) as MergeFieldCandidate<SocialLink>;
        const discardedValues = [...existingBucket.discardedValues];
        const previousRepresentativeSerialized = serializeMergeValue(
          existingBucket.representative.value,
        );

        if (
          nextRepresentative !== existingBucket.representative &&
          previousRepresentativeSerialized
        ) {
          discardedValues.push(previousRepresentativeSerialized);
        }

        buckets.set(
          key,
          Object.freeze({
            representative: nextRepresentative,
            sourceRecordIds: mergeUniqueSourceRecordIds([
              existingBucket.sourceRecordIds,
              itemCandidate.sourceRecordIds,
            ]),
            provenanceLists: Object.freeze([
              ...existingBucket.provenanceLists,
              remappedProvenance,
            ]),
            confidenceLists: Object.freeze([
              ...existingBucket.confidenceLists,
              remappedConfidence,
            ]),
            discardedValues: Object.freeze(discardedValues),
          }),
        );
      }
    }

    const mergedLinks: SocialLink[] = [];
    const fieldDiscardedValues: string[] = [];
    const seenFieldDiscardedValues = new Set<string>();

    for (const key of orderedKeys) {
      const bucket = buckets.get(key)!;
      const representative = bucket.representative.value;
      const itemProvenance = createFieldDecisionProvenance({
        groupId: context.currentGroup.groupId,
        fieldPath: `socialLinks.${key}`,
        strategyName: this.name,
        winnerSourceRecordIds: bucket.representative.sourceRecordIds,
        candidateSourceRecordIds: bucket.sourceRecordIds,
        extractedValue: representative.url,
        discardedValues: bucket.discardedValues,
        notes: 'Merged duplicate social links deterministically.',
        resolvedAt: context.mergeTimestamp,
      });

      for (const discardedValue of bucket.discardedValues) {
        if (discardedValue && !seenFieldDiscardedValues.has(discardedValue)) {
          seenFieldDiscardedValues.add(discardedValue);
          fieldDiscardedValues.push(discardedValue);
        }
      }

      mergedLinks.push(
        createSocialLink({
          ...representative,
          id: createDeterministicId('social-link', [
            context.currentGroup.groupId,
            key,
          ]),
          provenance: mergeUniqueProvenance([
            ...bucket.provenanceLists,
            [itemProvenance],
          ]),
          confidence: mergeUniqueConfidence(bucket.confidenceLists),
        }),
      );
    }

    const provenance =
      mergedLinks.length === 0
        ? []
        : [
            createFieldDecisionProvenance({
              groupId: context.currentGroup.groupId,
              fieldPath: fieldPlan.fieldPath,
              strategyName: this.name,
              winnerSourceRecordIds:
                buckets.get(orderedKeys[0] ?? '')?.representative.sourceRecordIds ??
                candidateSourceRecordIds,
              candidateSourceRecordIds,
              extractedValue: mergedLinks.map((link) => link.url).join(', '),
              discardedValues: fieldDiscardedValues,
              notes: 'Merged social links using ordered union semantics.',
              resolvedAt: context.mergeTimestamp,
            }),
          ];

    return Object.freeze({
      fieldPath: fieldPlan.fieldPath,
      strategyName: this.name,
      value: Object.freeze(mergedLinks),
      winnerSourceRecordIds:
        buckets.get(orderedKeys[0] ?? '')?.representative.sourceRecordIds ??
        candidateSourceRecordIds,
      candidateSourceRecordIds,
      discardedValues: Object.freeze(fieldDiscardedValues),
      provenance: Object.freeze(provenance),
    });
  }
}
