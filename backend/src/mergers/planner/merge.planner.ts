import {
  calculateValueCompleteness,
  compareMergeFieldCandidates,
  getSourcePriorityRank,
  getStableSourceRecordsForCandidate,
  hasMeaningfulValue,
  resolveSourcePriorityLabel,
  serializeMergeValue,
} from '../base/merge.context';
import type {
  CandidateGroup,
  MergeConfig,
  MergeFieldCandidate,
  MergeFieldPath,
  MergeFieldPlan,
  MergePlan,
  MergeStrategyName,
} from '../base/merge.types';
import { MERGE_FIELD_PATHS } from '../base/merge.types';

const STRATEGY_BY_FIELD: Readonly<Record<MergeFieldPath, MergeStrategyName>> =
  Object.freeze({
    firstName: 'scalar',
    middleName: 'scalar',
    lastName: 'scalar',
    fullName: 'scalar',
    headline: 'scalar',
    summary: 'scalar',
    location: 'scalar',
    contactInfo: 'contact',
    socialLinks: 'social',
    experiences: 'experience',
    education: 'education',
    skills: 'array',
    tags: 'array',
    additionalData: 'scalar',
  });

export class MergePlanner {
  constructor(private readonly config: MergeConfig) {}

  plan(group: CandidateGroup): MergePlan {
    const fields: Record<MergeFieldPath, MergeFieldPlan> = {
      firstName: this.createFieldPlan(group, 'firstName'),
      middleName: this.createFieldPlan(group, 'middleName'),
      lastName: this.createFieldPlan(group, 'lastName'),
      fullName: this.createFieldPlan(group, 'fullName'),
      headline: this.createFieldPlan(group, 'headline'),
      summary: this.createFieldPlan(group, 'summary'),
      location: this.createFieldPlan(group, 'location'),
      contactInfo: this.createFieldPlan(group, 'contactInfo'),
      socialLinks: this.createFieldPlan(group, 'socialLinks'),
      experiences: this.createFieldPlan(group, 'experiences'),
      education: this.createFieldPlan(group, 'education'),
      skills: this.createFieldPlan(group, 'skills'),
      tags: this.createFieldPlan(group, 'tags'),
      additionalData: this.createFieldPlan(group, 'additionalData'),
    };

    let conflictCount = 0;
    for (const fieldPath of MERGE_FIELD_PATHS) {
      if (fields[fieldPath].hasConflict) {
        conflictCount += 1;
      }
    }

    return Object.freeze({
      groupId: group.groupId,
      sourcePriority: [...this.config.sourcePriority],
      fields: Object.freeze(fields),
      allSourceRecordIds: Object.freeze(group.sourceRecords.map((record) => record.id)),
      conflictCount,
    });
  }

  private createFieldPlan(
    group: CandidateGroup,
    fieldPath: MergeFieldPath,
  ): MergeFieldPlan {
    const candidates: MergeFieldCandidate[] = [];
    const missingSourceIds: string[] = [];
    const serializedValues = new Set<string>();

    for (const groupedCandidate of group.candidates) {
      const sourceRecords = getStableSourceRecordsForCandidate(groupedCandidate, group);
      const sourceRecordIds = sourceRecords.map((record) => record.id);
      const prioritySourceRecord = this.getPrioritySourceRecord(sourceRecords);
      const value = groupedCandidate.candidate[fieldPath];

      if (!hasMeaningfulValue(value)) {
        for (const sourceRecordId of sourceRecordIds) {
          missingSourceIds.push(sourceRecordId);
        }
        continue;
      }

      const candidate = Object.freeze({
        value,
        sourceRecords,
        sourceRecordIds: Object.freeze(sourceRecordIds),
        sourcePriorityLabel: resolveSourcePriorityLabel(
          prioritySourceRecord,
          this.config,
        ),
        priorityRank: getSourcePriorityRank(prioritySourceRecord, this.config),
        candidateIndex: groupedCandidate.candidateIndex,
        completenessScore: calculateValueCompleteness(value),
      });

      candidates.push(candidate);
      serializedValues.add(serializeMergeValue(value));
    }

    candidates.sort((left, right) => compareMergeFieldCandidates(left, right));

    return Object.freeze({
      fieldPath,
      strategyName: STRATEGY_BY_FIELD[fieldPath],
      candidates: Object.freeze(candidates),
      missingSourceIds: Object.freeze(this.uniqueStrings(missingSourceIds)),
      hasConflict: serializedValues.size > 1,
    });
  }

  private getPrioritySourceRecord(sourceRecords: readonly CandidateGroup['sourceRecords'][number][]) {
    let winner = sourceRecords[0]!;

    for (let index = 1; index < sourceRecords.length; index += 1) {
      const challenger = sourceRecords[index]!;
      if (
        getSourcePriorityRank(challenger, this.config) <
        getSourcePriorityRank(winner, this.config)
      ) {
        winner = challenger;
      }
    }

    return winner;
  }

  private uniqueStrings(values: readonly string[]): readonly string[] {
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const value of values) {
      if (seen.has(value)) {
        continue;
      }

      seen.add(value);
      unique.push(value);
    }

    return unique;
  }
}
