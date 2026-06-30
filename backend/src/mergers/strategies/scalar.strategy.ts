import {
  choosePreferredCandidate,
  createFieldDecisionProvenance,
  hasMeaningfulValue,
  isSubstantiallyMoreComplete,
  mergeUniqueSourceRecordIds,
  serializeMergeValue,
} from '../base/merge.context';
import type { MergeStrategy } from '../base/merge.interface';
import type { MergeContext } from '../base/merge.context';
import type { MergeFieldCandidate, MergeFieldPlan, ResolvedField } from '../base/merge.types';

export class ScalarMergeStrategy implements MergeStrategy {
  public readonly name = 'scalar';

  merge(fieldPlan: MergeFieldPlan, context: MergeContext): ResolvedField {
    if (fieldPlan.fieldPath === 'additionalData') {
      return this.mergeAdditionalData(fieldPlan, context);
    }

    let winner: MergeFieldCandidate | undefined;
    const candidateSourceRecordIds = mergeUniqueSourceRecordIds(
      fieldPlan.candidates.map((candidate) => candidate.sourceRecordIds),
    );
    const discardedValues: string[] = [];
    const seenDiscarded = new Set<string>();

    for (const candidate of fieldPlan.candidates) {
      const previousWinner = winner;
      winner = choosePreferredCandidate(winner, candidate);

      if (
        previousWinner &&
        winner !== previousWinner &&
        hasMeaningfulValue(previousWinner.value)
      ) {
        const serialized = serializeMergeValue(previousWinner.value);
        if (serialized && !seenDiscarded.has(serialized)) {
          seenDiscarded.add(serialized);
          discardedValues.push(serialized);
        }
      }
    }

    if (!winner) {
      return Object.freeze({
        fieldPath: fieldPlan.fieldPath,
        strategyName: this.name,
        winnerSourceRecordIds: Object.freeze([]),
        candidateSourceRecordIds,
        discardedValues: Object.freeze([]),
        provenance: Object.freeze([]),
      });
    }

    for (const candidate of fieldPlan.candidates) {
      if (candidate === winner) {
        continue;
      }

      const serialized = serializeMergeValue(candidate.value);
      if (
        serialized &&
        serialized !== serializeMergeValue(winner.value) &&
        !seenDiscarded.has(serialized)
      ) {
        seenDiscarded.add(serialized);
        discardedValues.push(serialized);
      }
    }

    const provenance = createFieldDecisionProvenance({
      groupId: context.currentGroup.groupId,
      fieldPath: fieldPlan.fieldPath,
      strategyName: this.name,
      winnerSourceRecordIds: winner.sourceRecordIds,
      candidateSourceRecordIds,
      extractedValue: serializeMergeValue(winner.value),
      discardedValues,
      notes: fieldPlan.hasConflict
        ? 'Resolved with configured source priority and completeness rules.'
        : 'Merged deterministically without conflict.',
      resolvedAt: context.mergeTimestamp,
    });

    return Object.freeze({
      fieldPath: fieldPlan.fieldPath,
      strategyName: this.name,
      value: winner.value,
      winnerSourceRecordIds: winner.sourceRecordIds,
      candidateSourceRecordIds,
      discardedValues: Object.freeze(discardedValues),
      provenance: Object.freeze([provenance]),
    });
  }

  private mergeAdditionalData(
    fieldPlan: MergeFieldPlan,
    context: MergeContext,
  ): ResolvedField {
    const merged: Record<string, unknown> = {};
    const discardedValues: string[] = [];
    const seenDiscarded = new Set<string>();
    const contributingSourceIds: string[][] = [];
    let winnerSourceRecordIds: readonly string[] = [];

    for (const candidate of fieldPlan.candidates) {
      const value = candidate.value as Readonly<Record<string, unknown>>;
      let contributed = false;

      for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
        const challenger = value[key];

        if (!(key in merged)) {
          merged[key] = challenger;
          contributed = true;
          continue;
        }

        if (isSubstantiallyMoreComplete(challenger, merged[key])) {
          const serialized = serializeMergeValue(merged[key]);
          if (serialized && !seenDiscarded.has(serialized)) {
            seenDiscarded.add(serialized);
            discardedValues.push(serialized);
          }
          merged[key] = challenger;
          contributed = true;
        }
      }

      if (contributed) {
        contributingSourceIds.push([...candidate.sourceRecordIds]);
        if (winnerSourceRecordIds.length === 0) {
          winnerSourceRecordIds = candidate.sourceRecordIds;
        }
      }
    }

    const candidateSourceRecordIds = mergeUniqueSourceRecordIds(
      fieldPlan.candidates.map((candidate) => candidate.sourceRecordIds),
    );

    const provenance =
      Object.keys(merged).length === 0
        ? []
        : [
            createFieldDecisionProvenance({
              groupId: context.currentGroup.groupId,
              fieldPath: fieldPlan.fieldPath,
              strategyName: this.name,
              winnerSourceRecordIds:
                winnerSourceRecordIds.length > 0
                  ? winnerSourceRecordIds
                  : candidateSourceRecordIds,
              candidateSourceRecordIds:
                contributingSourceIds.length > 0
                  ? mergeUniqueSourceRecordIds(contributingSourceIds)
                  : candidateSourceRecordIds,
              extractedValue: serializeMergeValue(merged),
              discardedValues,
              notes: 'Merged additional data keys deterministically.',
              resolvedAt: context.mergeTimestamp,
            }),
          ];

    return Object.freeze({
      fieldPath: fieldPlan.fieldPath,
      strategyName: this.name,
      value: Object.freeze(merged),
      winnerSourceRecordIds:
        winnerSourceRecordIds.length > 0
          ? Object.freeze([...winnerSourceRecordIds])
          : candidateSourceRecordIds,
      candidateSourceRecordIds,
      discardedValues: Object.freeze(discardedValues),
      provenance: Object.freeze(provenance),
    });
  }
}
