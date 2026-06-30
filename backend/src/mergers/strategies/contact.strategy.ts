import { createContactInfo } from '../../models';
import type { ConfidenceScore, ContactInfo, Provenance } from '../../models';
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

type ContactBucket = {
  representative: MergeFieldCandidate<ContactInfo>;
  sourceRecordIds: readonly string[];
  provenanceLists: readonly (readonly Provenance[])[];
  confidenceLists: readonly (readonly ConfidenceScore[])[];
  discardedValues: readonly string[];
  isPrimary: boolean;
  isVerified: boolean;
};

export class ContactMergeStrategy implements MergeStrategy {
  public readonly name = 'contact';

  merge(fieldPlan: MergeFieldPlan, context: MergeContext): ResolvedField {
    const buckets = new Map<string, ContactBucket>();
    const orderedKeys: string[] = [];
    const candidateSourceRecordIds = mergeUniqueSourceRecordIds(
      fieldPlan.candidates.map((candidate) => candidate.sourceRecordIds),
    );

    for (const candidate of fieldPlan.candidates) {
      for (const contact of candidate.value as readonly ContactInfo[]) {
        const itemCandidate = Object.freeze({
          ...candidate,
          value: contact,
          completenessScore: calculateValueCompleteness(contact),
        });
        const key = `${contact.kind}:${contact.value.toLowerCase()}`;
        const remappedProvenance = remapProvenanceRecords(
          contact.provenance,
          context.currentGroup.sourceRecordIdMap,
        );
        const remappedConfidence = remapConfidenceScores(
          contact.confidence,
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
              isPrimary: contact.isPrimary,
              isVerified: contact.isVerified,
            }),
          );
          orderedKeys.push(key);
          continue;
        }

        const nextRepresentative = choosePreferredCandidate(
          existingBucket.representative,
          itemCandidate,
        ) as MergeFieldCandidate<ContactInfo>;
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
            isPrimary: existingBucket.isPrimary || contact.isPrimary,
            isVerified: existingBucket.isVerified || contact.isVerified,
          }),
        );
      }
    }

    const mergedContacts: ContactInfo[] = [];
    const fieldDiscardedValues: string[] = [];
    const seenFieldDiscardedValues = new Set<string>();

    for (const key of orderedKeys) {
      const bucket = buckets.get(key)!;
      const representative = bucket.representative.value;
      const itemProvenance = createFieldDecisionProvenance({
        groupId: context.currentGroup.groupId,
        fieldPath: `contactInfo.${key}`,
        strategyName: this.name,
        winnerSourceRecordIds: bucket.representative.sourceRecordIds,
        candidateSourceRecordIds: bucket.sourceRecordIds,
        extractedValue: representative.value,
        discardedValues: bucket.discardedValues,
        notes: 'Merged duplicate contact values deterministically.',
        resolvedAt: context.mergeTimestamp,
      });

      for (const discardedValue of bucket.discardedValues) {
        if (discardedValue && !seenFieldDiscardedValues.has(discardedValue)) {
          seenFieldDiscardedValues.add(discardedValue);
          fieldDiscardedValues.push(discardedValue);
        }
      }

      mergedContacts.push(
        createContactInfo({
          ...representative,
          id: createDeterministicId('contact-info', [
            context.currentGroup.groupId,
            key,
          ]),
          isPrimary: bucket.isPrimary,
          isVerified: bucket.isVerified,
          provenance: mergeUniqueProvenance([
            ...bucket.provenanceLists,
            [itemProvenance],
          ]),
          confidence: mergeUniqueConfidence(bucket.confidenceLists),
        }),
      );
    }

    const provenance =
      mergedContacts.length === 0
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
              extractedValue: mergedContacts.map((contact) => contact.value).join(', '),
              discardedValues: fieldDiscardedValues,
              notes: 'Merged contact values using ordered union semantics.',
              resolvedAt: context.mergeTimestamp,
            }),
          ];

    return Object.freeze({
      fieldPath: fieldPlan.fieldPath,
      strategyName: this.name,
      value: Object.freeze(mergedContacts),
      winnerSourceRecordIds:
        buckets.get(orderedKeys[0] ?? '')?.representative.sourceRecordIds ??
        candidateSourceRecordIds,
      candidateSourceRecordIds,
      discardedValues: Object.freeze(fieldDiscardedValues),
      provenance: Object.freeze(provenance),
    });
  }
}
