import { ProvenanceError } from '../../errors';
import {
  createDeterministicId,
  getSourcePriorityRank,
  mergeUniqueProvenance,
  serializeMergeValue,
} from '../../mergers/base/merge.context';
import { createProvenance } from '../../models';
import type { Provenance } from '../../models';
import type { ConfidenceContext } from '../../confidence/base/confidence.context';
import type { FieldProvenanceResult } from '../../confidence/base/confidence.types';

export class FieldHistoryBuilder {
  build(
    fieldPath: string,
    selectedValue: unknown,
    context: ConfidenceContext,
  ): FieldProvenanceResult {
    try {
      const selectedValueString = serializeMergeValue(selectedValue);
      const mergeProvenance = context.input.candidate.provenance.filter(
        (entry) =>
          entry.fieldPath === fieldPath || entry.fieldPath.startsWith(`${fieldPath}.`),
      );
      const sourceEntries: Provenance[] = [];

      for (const relatedCandidate of context.input.normalizedCandidates) {
        const sourceRecord = relatedCandidate.stableSourceRecords[0];
        if (!sourceRecord) {
          continue;
        }

        const matchingOperations = relatedCandidate.normalizationOperations.filter(
          (operation) =>
            operation.field === fieldPath || operation.field.startsWith(`${fieldPath}.`),
        );
        const operations = matchingOperations.length > 0 ? matchingOperations : [undefined];
        const candidateValue = relatedCandidate.candidate[
          fieldPath as keyof typeof relatedCandidate.candidate
        ];
        const existingMergeEntry = mergeProvenance.find(
          (entry) =>
            entry.sourceRecordId === sourceRecord.id ||
            entry.candidateSourceRecordIds?.includes(sourceRecord.id),
        );

        for (const normalizationOperation of operations) {
          const selectedFieldValue = this.resolveFieldValue(
            fieldPath,
            selectedValue,
            normalizationOperation?.field,
          );
          const candidateFieldValue = this.resolveFieldValue(
            fieldPath,
            candidateValue,
            normalizationOperation?.field,
          );

          sourceEntries.push(
            createProvenance({
              id: createDeterministicId('field-history', [
                context.input.candidate.id,
                fieldPath,
                sourceRecord.id,
                normalizationOperation?.field ?? '',
                selectedValueString,
              ]),
              sourceRecordId: sourceRecord.id,
              fieldPath,
              extractedValue: serializeMergeValue(candidateFieldValue),
              originalValue:
                normalizationOperation?.originalValue ??
                serializeMergeValue(candidateFieldValue),
              normalizedValue:
                normalizationOperation?.normalizedValue ??
                serializeMergeValue(candidateFieldValue),
              selectedValue:
                serializeMergeValue(selectedFieldValue) || selectedValueString || undefined,
              sourceName: sourceRecord.sourceName,
              sourcePriority: getSourcePriorityRank(sourceRecord, {
                sourcePriority: Object.keys(context.config.sourceWeights),
                sourceMatchers: {},
                identityFallbackEnabled: true,
              }),
              extractor: sourceRecord.extractor,
              normalizer: normalizationOperation?.normalizer,
              timestamp:
                normalizationOperation?.timestamp ?? sourceRecord.receivedAt,
              winningSourceRecordIds: existingMergeEntry?.winningSourceRecordIds,
              candidateSourceRecordIds:
                existingMergeEntry?.candidateSourceRecordIds ?? [sourceRecord.id],
              mergeStrategy: existingMergeEntry?.mergeStrategy,
              discardedValues: existingMergeEntry?.discardedValues,
              resolvedAt: existingMergeEntry?.resolvedAt,
              notes:
                existingMergeEntry?.notes ??
                'Field lineage reconstructed deterministically.',
            }),
          );
        }
      }

      return Object.freeze({
        fieldPath,
        entries: mergeUniqueProvenance([mergeProvenance, sourceEntries]),
      });
    } catch (error) {
      throw new ProvenanceError('Failed to build field history.', {
        candidateId: context.input.candidate.id,
        field: fieldPath,
        reason: 'field-history-build-failure',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  private resolveFieldValue(
    fieldPath: string,
    value: unknown,
    normalizationField: string | undefined,
  ): unknown {
    if (fieldPath === 'contactInfo' && Array.isArray(value) && normalizationField) {
      const normalizedField = normalizationField.toLowerCase();

      if (normalizedField.includes('email')) {
        const match = value.find(
          (entry) =>
            typeof entry === 'object' &&
            entry !== null &&
            (entry as { kind?: string }).kind === 'email',
        );
        return typeof match === 'object' && match !== null
          ? (match as { value?: string }).value
          : match;
      }

      if (normalizedField.includes('phone')) {
        const match = value.find(
          (entry) =>
            typeof entry === 'object' &&
            entry !== null &&
            (entry as { kind?: string }).kind === 'phone',
        );
        return typeof match === 'object' && match !== null
          ? (match as { value?: string }).value
          : match;
      }
    }

    return value;
  }
}
