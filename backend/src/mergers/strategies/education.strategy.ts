import { createEducation } from '../../models';
import type { ConfidenceScore, Education, Provenance } from '../../models';
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

type EducationBucket = {
  representative: MergeFieldCandidate<Education>;
  sourceRecordIds: readonly string[];
  provenanceLists: readonly (readonly Provenance[])[];
  confidenceLists: readonly (readonly ConfidenceScore[])[];
  discardedValues: readonly string[];
  startDates: readonly string[];
  endDates: readonly string[];
};

export class EducationMergeStrategy implements MergeStrategy {
  public readonly name = 'education';

  merge(fieldPlan: MergeFieldPlan, context: MergeContext): ResolvedField {
    const bucketsByKey = new Map<string, EducationBucket[]>();
    const orderedBuckets: EducationBucket[] = [];
    const candidateSourceRecordIds = mergeUniqueSourceRecordIds(
      fieldPlan.candidates.map((candidate) => candidate.sourceRecordIds),
    );

    for (const candidate of fieldPlan.candidates) {
      for (const education of candidate.value as readonly Education[]) {
        const itemCandidate = Object.freeze({
          ...candidate,
          value: education,
          completenessScore: calculateValueCompleteness(education),
        });
        const key = this.buildBucketKey(education);
        const buckets = bucketsByKey.get(key) ?? [];
        const remappedProvenance = remapProvenanceRecords(
          education.provenance,
          context.currentGroup.sourceRecordIdMap,
        );
        const remappedConfidence = remapConfidenceScores(
          education.confidence,
          context.currentGroup.sourceRecordIdMap,
        );
        const matchingBucketIndex = buckets.findIndex((bucket) =>
          this.isDuplicateEducation(bucket.representative.value, education),
        );

        if (matchingBucketIndex < 0) {
          const bucket = Object.freeze({
            representative: itemCandidate,
            sourceRecordIds: itemCandidate.sourceRecordIds,
            provenanceLists: Object.freeze([remappedProvenance]),
            confidenceLists: Object.freeze([remappedConfidence]),
            discardedValues: Object.freeze([]),
            startDates: Object.freeze(education.startDate ? [education.startDate] : []),
            endDates: Object.freeze(education.endDate ? [education.endDate] : []),
          });
          buckets.push(bucket);
          bucketsByKey.set(key, buckets);
          orderedBuckets.push(bucket);
          continue;
        }

        const currentBucket = buckets[matchingBucketIndex]!;
        const nextRepresentative = choosePreferredCandidate(
          currentBucket.representative,
          itemCandidate,
        ) as MergeFieldCandidate<Education>;
        const discardedValues = [...currentBucket.discardedValues];
        const previousRepresentativeSerialized = serializeMergeValue(
          currentBucket.representative.value,
        );

        if (
          nextRepresentative !== currentBucket.representative &&
          previousRepresentativeSerialized
        ) {
          discardedValues.push(previousRepresentativeSerialized);
        }

        const nextBucket = Object.freeze({
          representative: nextRepresentative,
          sourceRecordIds: mergeUniqueSourceRecordIds([
            currentBucket.sourceRecordIds,
            itemCandidate.sourceRecordIds,
          ]),
          provenanceLists: Object.freeze([
            ...currentBucket.provenanceLists,
            remappedProvenance,
          ]),
          confidenceLists: Object.freeze([
            ...currentBucket.confidenceLists,
            remappedConfidence,
          ]),
          discardedValues: Object.freeze(discardedValues),
          startDates: Object.freeze(
            this.mergeDateValues(
              currentBucket.startDates,
              education.startDate ? [education.startDate] : [],
            ),
          ),
          endDates: Object.freeze(
            this.mergeDateValues(
              currentBucket.endDates,
              education.endDate ? [education.endDate] : [],
            ),
          ),
        });

        buckets[matchingBucketIndex] = nextBucket;
        bucketsByKey.set(key, buckets);
        orderedBuckets[orderedBuckets.indexOf(currentBucket)] = nextBucket;
      }
    }

    const mergedEducation: Education[] = [];
    const fieldDiscardedValues: string[] = [];
    const seenFieldDiscardedValues = new Set<string>();

    for (let index = 0; index < orderedBuckets.length; index += 1) {
      const bucket = orderedBuckets[index]!;
      const representative = bucket.representative.value;
      const itemProvenance = createFieldDecisionProvenance({
        groupId: context.currentGroup.groupId,
        fieldPath: `education.${index}`,
        strategyName: this.name,
        winnerSourceRecordIds: bucket.representative.sourceRecordIds,
        candidateSourceRecordIds: bucket.sourceRecordIds,
        extractedValue: representative.institution,
        discardedValues: bucket.discardedValues,
        notes: 'Merged duplicate education values deterministically.',
        resolvedAt: context.mergeTimestamp,
      });

      for (const discardedValue of bucket.discardedValues) {
        if (discardedValue && !seenFieldDiscardedValues.has(discardedValue)) {
          seenFieldDiscardedValues.add(discardedValue);
          fieldDiscardedValues.push(discardedValue);
        }
      }

      mergedEducation.push(
        createEducation({
          ...representative,
          id: createDeterministicId('education', [
            context.currentGroup.groupId,
            representative.institution.toLowerCase(),
            representative.degree?.toLowerCase() ?? '',
            this.getGraduationYear(representative) ?? '',
            String(index),
          ]),
          startDate: this.getEarliestDate(bucket.startDates),
          endDate: this.getLatestDate(bucket.endDates),
          provenance: mergeUniqueProvenance([
            ...bucket.provenanceLists,
            [itemProvenance],
          ]),
          confidence: mergeUniqueConfidence(bucket.confidenceLists),
        }),
      );
    }

    const provenance =
      mergedEducation.length === 0
        ? []
        : [
            createFieldDecisionProvenance({
              groupId: context.currentGroup.groupId,
              fieldPath: fieldPlan.fieldPath,
              strategyName: this.name,
              winnerSourceRecordIds:
                orderedBuckets[0]?.representative.sourceRecordIds ??
                candidateSourceRecordIds,
              candidateSourceRecordIds,
              extractedValue: mergedEducation
                .map((education) => education.institution)
                .join(', '),
              discardedValues: fieldDiscardedValues,
              notes: 'Merged education using institution, degree, and graduation year rules.',
              resolvedAt: context.mergeTimestamp,
            }),
          ];

    return Object.freeze({
      fieldPath: fieldPlan.fieldPath,
      strategyName: this.name,
      value: Object.freeze(mergedEducation),
      winnerSourceRecordIds:
        orderedBuckets[0]?.representative.sourceRecordIds ?? candidateSourceRecordIds,
      candidateSourceRecordIds,
      discardedValues: Object.freeze(fieldDiscardedValues),
      provenance: Object.freeze(provenance),
    });
  }

  private buildBucketKey(education: Education): string {
    return [
      education.institution.toLowerCase(),
      education.degree?.toLowerCase() ?? '',
    ].join('|');
  }

  private isDuplicateEducation(left: Education, right: Education): boolean {
    if (this.buildBucketKey(left) !== this.buildBucketKey(right)) {
      return false;
    }

    const leftGraduationYear = this.getGraduationYear(left);
    const rightGraduationYear = this.getGraduationYear(right);

    if (leftGraduationYear && rightGraduationYear) {
      return leftGraduationYear === rightGraduationYear;
    }

    return !leftGraduationYear || !rightGraduationYear;
  }

  private getGraduationYear(education: Education): string | undefined {
    return education.endDate?.slice(0, 4);
  }

  private mergeDateValues(
    currentValues: readonly string[],
    nextValues: readonly string[],
  ): readonly string[] {
    const values = [...currentValues];

    for (const value of nextValues) {
      if (!values.includes(value)) {
        values.push(value);
      }
    }

    return values;
  }

  private getEarliestDate(values: readonly string[]): string | undefined {
    if (values.length === 0) {
      return undefined;
    }

    return [...values].sort((left, right) => left.localeCompare(right))[0];
  }

  private getLatestDate(values: readonly string[]): string | undefined {
    if (values.length === 0) {
      return undefined;
    }

    const sorted = [...values].sort((left, right) => left.localeCompare(right));
    return sorted[sorted.length - 1];
  }
}
