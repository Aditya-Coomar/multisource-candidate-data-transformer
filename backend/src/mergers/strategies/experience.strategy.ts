import { createExperience, createSkill } from '../../models';
import type { ConfidenceScore, Experience, Provenance, Skill } from '../../models';
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
  toComparableEndDate,
  toComparableStartDate,
} from '../base/merge.context';
import type { MergeStrategy } from '../base/merge.interface';
import type { MergeContext } from '../base/merge.context';
import type { MergeFieldCandidate, MergeFieldPlan, ResolvedField } from '../base/merge.types';

type SkillCandidate = MergeFieldCandidate<Skill>;

type ExperienceBucket = {
  representative: MergeFieldCandidate<Experience>;
  sourceRecordIds: readonly string[];
  provenanceLists: readonly (readonly Provenance[])[];
  confidenceLists: readonly (readonly ConfidenceScore[])[];
  skillCandidates: readonly SkillCandidate[];
  discardedValues: readonly string[];
  startDates: readonly string[];
  endDates: readonly string[];
  isCurrent: boolean;
};

type SkillBucket = {
  representative: SkillCandidate;
  sourceRecordIds: readonly string[];
  provenanceLists: readonly (readonly Provenance[])[];
  confidenceLists: readonly (readonly ConfidenceScore[])[];
  discardedValues: readonly string[];
};

export class ExperienceMergeStrategy implements MergeStrategy {
  public readonly name = 'experience';

  merge(fieldPlan: MergeFieldPlan, context: MergeContext): ResolvedField {
    const bucketsByKey = new Map<string, ExperienceBucket[]>();
    const orderedBuckets: ExperienceBucket[] = [];
    const candidateSourceRecordIds = mergeUniqueSourceRecordIds(
      fieldPlan.candidates.map((candidate) => candidate.sourceRecordIds),
    );

    for (const candidate of fieldPlan.candidates) {
      for (const experience of candidate.value as readonly Experience[]) {
        const itemCandidate = Object.freeze({
          ...candidate,
          value: experience,
          completenessScore: calculateValueCompleteness(experience),
        });
        const key = this.buildBucketKey(experience);
        const buckets = bucketsByKey.get(key) ?? [];
        const remappedProvenance = remapProvenanceRecords(
          experience.provenance,
          context.currentGroup.sourceRecordIdMap,
        );
        const remappedConfidence = remapConfidenceScores(
          experience.confidence,
          context.currentGroup.sourceRecordIdMap,
        );
        const skillCandidates = this.createSkillCandidates(candidate, experience.skills);
        const matchingBucketIndex = buckets.findIndex((bucket) =>
          this.isDuplicateExperience(bucket.representative.value, experience),
        );

        if (matchingBucketIndex < 0) {
          const bucket = Object.freeze({
            representative: itemCandidate,
            sourceRecordIds: itemCandidate.sourceRecordIds,
            provenanceLists: Object.freeze([remappedProvenance]),
            confidenceLists: Object.freeze([remappedConfidence]),
            skillCandidates: Object.freeze(skillCandidates),
            discardedValues: Object.freeze([]),
            startDates: Object.freeze(
              experience.startDate ? [experience.startDate] : [],
            ),
            endDates: Object.freeze(experience.endDate ? [experience.endDate] : []),
            isCurrent: experience.isCurrent,
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
        ) as MergeFieldCandidate<Experience>;
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
          skillCandidates: Object.freeze([
            ...currentBucket.skillCandidates,
            ...skillCandidates,
          ]),
          discardedValues: Object.freeze(discardedValues),
          startDates: Object.freeze(
            this.mergeDateValues(
              currentBucket.startDates,
              experience.startDate ? [experience.startDate] : [],
            ),
          ),
          endDates: Object.freeze(
            this.mergeDateValues(
              currentBucket.endDates,
              experience.endDate ? [experience.endDate] : [],
            ),
          ),
          isCurrent: currentBucket.isCurrent || experience.isCurrent,
        });

        buckets[matchingBucketIndex] = nextBucket;
        bucketsByKey.set(key, buckets);
        orderedBuckets[orderedBuckets.indexOf(currentBucket)] = nextBucket;
      }
    }

    const mergedExperiences: Experience[] = [];
    const fieldDiscardedValues: string[] = [];
    const seenFieldDiscardedValues = new Set<string>();

    for (let index = 0; index < orderedBuckets.length; index += 1) {
      const bucket = orderedBuckets[index]!;
      const representative = bucket.representative.value;
      const mergedSkills = this.mergeSkills(bucket, context, index);
      const startDate = this.getEarliestDate(bucket.startDates);
      const endDate = bucket.isCurrent ? undefined : this.getLatestDate(bucket.endDates);
      const itemProvenance = createFieldDecisionProvenance({
        groupId: context.currentGroup.groupId,
        fieldPath: `experiences.${index}`,
        strategyName: this.name,
        winnerSourceRecordIds: bucket.representative.sourceRecordIds,
        candidateSourceRecordIds: bucket.sourceRecordIds,
        extractedValue: representative.employer,
        discardedValues: bucket.discardedValues,
        notes: 'Merged duplicate experience values deterministically.',
        resolvedAt: context.mergeTimestamp,
      });

      for (const discardedValue of bucket.discardedValues) {
        if (discardedValue && !seenFieldDiscardedValues.has(discardedValue)) {
          seenFieldDiscardedValues.add(discardedValue);
          fieldDiscardedValues.push(discardedValue);
        }
      }

      mergedExperiences.push(
        createExperience({
          ...representative,
          id: createDeterministicId('experience', [
            context.currentGroup.groupId,
            representative.employer.toLowerCase(),
            representative.title?.toLowerCase() ?? '',
            startDate ?? '',
            String(index),
          ]),
          startDate,
          endDate,
          isCurrent: bucket.isCurrent,
          skills: mergedSkills,
          provenance: mergeUniqueProvenance([
            ...bucket.provenanceLists,
            [itemProvenance],
          ]),
          confidence: mergeUniqueConfidence(bucket.confidenceLists),
        }),
      );
    }

    const provenance =
      mergedExperiences.length === 0
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
              extractedValue: mergedExperiences
                .map((experience) => experience.employer)
                .join(', '),
              discardedValues: fieldDiscardedValues,
              notes: 'Merged experiences using employer, role, and date rules.',
              resolvedAt: context.mergeTimestamp,
            }),
          ];

    return Object.freeze({
      fieldPath: fieldPlan.fieldPath,
      strategyName: this.name,
      value: Object.freeze(mergedExperiences),
      winnerSourceRecordIds:
        orderedBuckets[0]?.representative.sourceRecordIds ?? candidateSourceRecordIds,
      candidateSourceRecordIds,
      discardedValues: Object.freeze(fieldDiscardedValues),
      provenance: Object.freeze(provenance),
    });
  }

  private createSkillCandidates(
    candidate: MergeFieldCandidate,
    skills: readonly Skill[],
  ): readonly SkillCandidate[] {
    return Object.freeze(
      skills.map((skill) =>
        Object.freeze({
          ...candidate,
          value: skill,
          completenessScore: calculateValueCompleteness(skill),
        }),
      ),
    );
  }

  private mergeSkills(
    bucket: ExperienceBucket,
    context: MergeContext,
    experienceIndex: number,
  ): readonly Skill[] {
    const skillBuckets = new Map<string, SkillBucket>();
    const orderedKeys: string[] = [];

    for (const skillCandidate of bucket.skillCandidates) {
      const key = skillCandidate.value.name.toLowerCase();
      const remappedProvenance = remapProvenanceRecords(
        skillCandidate.value.provenance,
        context.currentGroup.sourceRecordIdMap,
      );
      const remappedConfidence = remapConfidenceScores(
        skillCandidate.value.confidence,
        context.currentGroup.sourceRecordIdMap,
      );
      const existingBucket = skillBuckets.get(key);

      if (!existingBucket) {
        skillBuckets.set(
          key,
          Object.freeze({
            representative: skillCandidate,
            sourceRecordIds: skillCandidate.sourceRecordIds,
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
        skillCandidate,
      ) as SkillCandidate;
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

      skillBuckets.set(
        key,
        Object.freeze({
          representative: nextRepresentative,
          sourceRecordIds: mergeUniqueSourceRecordIds([
            existingBucket.sourceRecordIds,
            skillCandidate.sourceRecordIds,
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

    const mergedSkills: Skill[] = [];

    for (const key of orderedKeys) {
      const skillBucket = skillBuckets.get(key)!;
      const representative = skillBucket.representative.value;
      const provenance = createFieldDecisionProvenance({
        groupId: context.currentGroup.groupId,
        fieldPath: `experiences.${experienceIndex}.skills.${key}`,
        strategyName: this.name,
        winnerSourceRecordIds: skillBucket.representative.sourceRecordIds,
        candidateSourceRecordIds: skillBucket.sourceRecordIds,
        extractedValue: representative.name,
        discardedValues: skillBucket.discardedValues,
        notes: 'Merged duplicate nested skills deterministically.',
        resolvedAt: context.mergeTimestamp,
      });

      mergedSkills.push(
        createSkill({
          ...representative,
          id: createDeterministicId('experience-skill', [
            context.currentGroup.groupId,
            String(experienceIndex),
            key,
          ]),
          provenance: mergeUniqueProvenance([
            ...skillBucket.provenanceLists,
            [provenance],
          ]),
          confidence: mergeUniqueConfidence(skillBucket.confidenceLists),
        }),
      );
    }

    return Object.freeze(mergedSkills);
  }

  private buildBucketKey(experience: Experience): string {
    return [
      experience.employer.toLowerCase(),
      experience.title?.toLowerCase() ?? '',
    ].join('|');
  }

  private isDuplicateExperience(left: Experience, right: Experience): boolean {
    if (this.buildBucketKey(left) !== this.buildBucketKey(right)) {
      return false;
    }

    if (left.startDate && right.startDate && left.startDate === right.startDate) {
      return true;
    }

    if (!left.startDate || !right.startDate) {
      return true;
    }

    return this.dateRangesOverlap(left, right);
  }

  private dateRangesOverlap(left: Experience, right: Experience): boolean {
    const leftStart = toComparableStartDate(left.startDate);
    const leftEnd = toComparableEndDate(left.isCurrent ? undefined : left.endDate);
    const rightStart = toComparableStartDate(right.startDate);
    const rightEnd = toComparableEndDate(right.isCurrent ? undefined : right.endDate);

    return leftStart.localeCompare(rightEnd) <= 0 && rightStart.localeCompare(leftEnd) <= 0;
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
