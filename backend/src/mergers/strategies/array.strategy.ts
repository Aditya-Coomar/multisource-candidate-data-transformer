import { createSkill } from '../../models';
import type { ConfidenceScore, Provenance, Skill } from '../../models';
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
import { StrategyError } from '../../errors';

type SkillBucket = {
  representative: MergeFieldCandidate<Skill>;
  sourceRecordIds: readonly string[];
  provenanceLists: readonly (readonly Provenance[])[];
  confidenceLists: readonly (readonly ConfidenceScore[])[];
  discardedValues: readonly string[];
};

export class ArrayMergeStrategy implements MergeStrategy {
  public readonly name = 'array';

  merge(fieldPlan: MergeFieldPlan, context: MergeContext): ResolvedField {
    if (fieldPlan.fieldPath === 'tags') {
      return this.mergeTags(fieldPlan, context);
    }

    if (fieldPlan.fieldPath === 'skills') {
      return this.mergeSkills(fieldPlan, context);
    }

    throw new StrategyError('Array strategy does not support the field.', {
      groupId: context.currentGroup.groupId,
      field: fieldPlan.fieldPath,
      reason: 'unsupported-array-field',
      sourceIds: context.mergePlan.allSourceRecordIds,
    });
  }

  private mergeTags(fieldPlan: MergeFieldPlan, context: MergeContext): ResolvedField {
    const winners = new Map<string, MergeFieldCandidate<string>>();
    const orderedKeys: string[] = [];
    const bucketSourceIds = new Map<string, readonly string[]>();
    const discardedValues: string[] = [];
    const seenDiscarded = new Set<string>();

    for (const candidate of fieldPlan.candidates) {
      for (const tag of candidate.value as readonly string[]) {
        const itemCandidate = Object.freeze({
          ...candidate,
          value: tag,
          completenessScore: calculateValueCompleteness(tag),
        });
        const key = tag.toLowerCase();
        const current = winners.get(key);

        if (!current) {
          winners.set(key, itemCandidate);
          bucketSourceIds.set(key, itemCandidate.sourceRecordIds);
          orderedKeys.push(key);
          continue;
        }

        const winner = choosePreferredCandidate(current, itemCandidate);
        if (winner !== current) {
          const serialized = serializeMergeValue(current.value);
          if (serialized && !seenDiscarded.has(serialized)) {
            seenDiscarded.add(serialized);
            discardedValues.push(serialized);
          }
        }

        winners.set(key, winner as MergeFieldCandidate<string>);
        bucketSourceIds.set(
          key,
          mergeUniqueSourceRecordIds([
            bucketSourceIds.get(key) ?? [],
            itemCandidate.sourceRecordIds,
          ]),
        );
      }
    }

    const mergedTags: string[] = [];
    const candidateSourceRecordIds = mergeUniqueSourceRecordIds(
      fieldPlan.candidates.map((candidate) => candidate.sourceRecordIds),
    );

    for (const key of orderedKeys) {
      const winner = winners.get(key);
      if (winner) {
        mergedTags.push(winner.value);
      }
    }

    const provenance =
      mergedTags.length === 0
        ? []
        : [
            createFieldDecisionProvenance({
              groupId: context.currentGroup.groupId,
              fieldPath: fieldPlan.fieldPath,
              strategyName: this.name,
              winnerSourceRecordIds:
                winners.get(orderedKeys[0] ?? '')?.sourceRecordIds ??
                candidateSourceRecordIds,
              candidateSourceRecordIds,
              extractedValue: mergedTags.join(', '),
              discardedValues,
              notes: 'Merged array values using ordered union semantics.',
              resolvedAt: context.mergeTimestamp,
            }),
          ];

    return Object.freeze({
      fieldPath: fieldPlan.fieldPath,
      strategyName: this.name,
      value: Object.freeze(mergedTags),
      winnerSourceRecordIds:
        winners.get(orderedKeys[0] ?? '')?.sourceRecordIds ?? candidateSourceRecordIds,
      candidateSourceRecordIds,
      discardedValues: Object.freeze(discardedValues),
      provenance: Object.freeze(provenance),
    });
  }

  private mergeSkills(fieldPlan: MergeFieldPlan, context: MergeContext): ResolvedField {
    const buckets = new Map<string, SkillBucket>();
    const orderedKeys: string[] = [];
    const candidateSourceRecordIds = mergeUniqueSourceRecordIds(
      fieldPlan.candidates.map((candidate) => candidate.sourceRecordIds),
    );

    for (const candidate of fieldPlan.candidates) {
      for (const skill of candidate.value as readonly Skill[]) {
        const itemCandidate = Object.freeze({
          ...candidate,
          value: skill,
          completenessScore: calculateValueCompleteness(skill),
        });
        const key = skill.name.toLowerCase();
        const remappedProvenance = remapProvenanceRecords(
          skill.provenance,
          context.currentGroup.sourceRecordIdMap,
        );
        const remappedConfidence = remapConfidenceScores(
          skill.confidence,
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
        ) as MergeFieldCandidate<Skill>;
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

    const mergedSkills: Skill[] = [];
    const fieldDiscardedValues: string[] = [];
    const seenFieldDiscardedValues = new Set<string>();

    for (const key of orderedKeys) {
      const bucket = buckets.get(key)!;
      const representative = bucket.representative.value;
      const itemProvenance = createFieldDecisionProvenance({
        groupId: context.currentGroup.groupId,
        fieldPath: `skills.${key}`,
        strategyName: this.name,
        winnerSourceRecordIds: bucket.representative.sourceRecordIds,
        candidateSourceRecordIds: bucket.sourceRecordIds,
        extractedValue: representative.name,
        discardedValues: bucket.discardedValues,
        notes: 'Merged duplicate skill values deterministically.',
        resolvedAt: context.mergeTimestamp,
      });

      for (const discardedValue of bucket.discardedValues) {
        if (discardedValue && !seenFieldDiscardedValues.has(discardedValue)) {
          seenFieldDiscardedValues.add(discardedValue);
          fieldDiscardedValues.push(discardedValue);
        }
      }

      mergedSkills.push(
        createSkill({
          ...representative,
          id: createDeterministicId('skill', [
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
      mergedSkills.length === 0
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
              extractedValue: mergedSkills.map((skill) => skill.name).join(', '),
              discardedValues: fieldDiscardedValues,
              notes: 'Merged skills using ordered union semantics.',
              resolvedAt: context.mergeTimestamp,
            }),
          ];

    return Object.freeze({
      fieldPath: fieldPlan.fieldPath,
      strategyName: this.name,
      value: Object.freeze(mergedSkills),
      winnerSourceRecordIds:
        buckets.get(orderedKeys[0] ?? '')?.representative.sourceRecordIds ??
        candidateSourceRecordIds,
      candidateSourceRecordIds,
      discardedValues: Object.freeze(fieldDiscardedValues),
      provenance: Object.freeze(provenance),
    });
  }
}
