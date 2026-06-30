import { MergeConflictError, StrategyError } from '../../errors';
import type { MergeStrategy } from '../base/merge.interface';
import type { MergeContext } from '../base/merge.context';
import type {
  MergeFieldPath,
  MergeResolvedFields,
  MergeStrategyName,
  ResolvedField,
} from '../base/merge.types';
import { MERGE_FIELD_PATHS } from '../base/merge.types';

export class ConflictResolver {
  constructor(
    private readonly strategies: Readonly<Record<MergeStrategyName, MergeStrategy>>,
  ) {}

  resolve(context: MergeContext): MergeResolvedFields {
    const resolvedFields: Record<MergeFieldPath, ResolvedField | undefined> = {
      firstName: undefined,
      middleName: undefined,
      lastName: undefined,
      fullName: undefined,
      headline: undefined,
      summary: undefined,
      location: undefined,
      contactInfo: undefined,
      socialLinks: undefined,
      experiences: undefined,
      education: undefined,
      skills: undefined,
      tags: undefined,
      additionalData: undefined,
    };

    for (const fieldPath of MERGE_FIELD_PATHS) {
      const fieldPlan = context.mergePlan.fields[fieldPath];
      const strategy = this.strategies[fieldPlan.strategyName];

      if (!strategy) {
        throw new StrategyError('No merge strategy registered for field.', {
          groupId: context.currentGroup.groupId,
          field: fieldPath,
          reason: 'missing-strategy',
          sourceIds: context.mergePlan.allSourceRecordIds,
          details: {
            strategyName: fieldPlan.strategyName,
          },
        });
      }

      context.logger.debug('merge.strategy.selected', {
        groupId: context.currentGroup.groupId,
        fieldPath,
        strategy: fieldPlan.strategyName,
      });

      if (fieldPlan.hasConflict) {
        context.logger.warn('merge.conflict.detected', {
          groupId: context.currentGroup.groupId,
          fieldPath,
          sourceCount: fieldPlan.candidates.length,
        });
      }

      const resolvedField = strategy.merge(fieldPlan, context);
      resolvedFields[fieldPath] = resolvedField;

      if (
        fieldPlan.hasConflict &&
        resolvedField.winnerSourceRecordIds.length === 0 &&
        fieldPlan.candidates.length > 0
      ) {
        throw new MergeConflictError('Conflicting values could not be resolved.', {
          groupId: context.currentGroup.groupId,
          field: fieldPath,
          reason: 'missing-winner',
          sourceIds: context.mergePlan.allSourceRecordIds,
        });
      }

      context.logger.debug('merge.winner.selected', {
        groupId: context.currentGroup.groupId,
        fieldPath,
        winningSourceIds: resolvedField.winnerSourceRecordIds,
      });
    }

    return Object.freeze(resolvedFields);
  }
}
