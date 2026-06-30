import { CalculatorError } from '../../errors';
import type { ConfidenceCalculator } from '../base/confidence.interface';
import type { ConfidenceContext } from '../base/confidence.context';
import {
  buildConfidenceScoreRecord,
  clampScore,
  getFieldWeight,
  getPrimarySourceRecordForField,
  getSourceWeight,
} from '../base/confidence.context';
import type { WeightedConfidenceStrategy } from '../base/confidence.interface';
import { AgreementStrategy } from '../strategies/agreement.strategy';
import { CompletenessStrategy } from '../strategies/completeness.strategy';
import { SourceStrategy } from '../strategies/source.strategy';
import { ValidationStrategy } from '../strategies/validation.strategy';

export class FieldCalculator implements ConfidenceCalculator {
  private readonly sourceStrategy = new SourceStrategy();
  private readonly agreementStrategy = new AgreementStrategy();
  private readonly completenessStrategy = new CompletenessStrategy();
  private readonly validationStrategy = new ValidationStrategy();

  constructor(private readonly weightedStrategy: WeightedConfidenceStrategy) {}

  calculate(
    fieldPath: string,
    value: unknown,
    context: ConfidenceContext,
  ) {
    try {
      const provenance = context.input.candidate.provenance.filter(
        (entry) =>
          entry.fieldPath === fieldPath || entry.fieldPath.startsWith(`${fieldPath}.`),
      );
      const primarySource = getPrimarySourceRecordForField(
        provenance,
        context.input.candidate,
      );
      const sourceWeight =
        provenance.length > 0
          ? this.sourceStrategy.score(fieldPath, value, context)
          : getSourceWeight(primarySource, context);
      const agreementScore = this.agreementStrategy.score(
        fieldPath,
        value,
        context,
      );
      const completenessScore = this.completenessStrategy.score(
        fieldPath,
        value,
        context,
      );
      const validationScore = clampScore(
        this.validationStrategy.score(fieldPath, value, context),
      );
      const score = this.weightedStrategy.combine({
        sourceWeight,
        agreementScore,
        completenessScore,
        validationScore,
      });
      const fieldWeight = getFieldWeight(fieldPath, context);
      const confidence = buildConfidenceScoreRecord({
        fieldPath,
        score,
        reason: `Deterministic score from source=${sourceWeight.toFixed(2)}, agreement=${agreementScore.toFixed(2)}, completeness=${completenessScore.toFixed(2)}, validation=${validationScore.toFixed(2)}.`,
        sourceRecordId: primarySource?.id,
        components: {
          sourceWeight,
          agreementScore,
          completenessScore,
          validationScore,
        },
        fieldWeight,
        calculatedAt: context.processingCompletedAt,
      });

      if (score < 0.6) {
        context.logger.warn('confidence.low', {
          candidateId: context.input.candidate.id,
          fieldPath,
        });
      }

      context.logger.debug('confidence.field.calculated', {
        candidateId: context.input.candidate.id,
        fieldPath,
      });

      return Object.freeze({
        fieldPath,
        score,
        reason: confidence.reason ?? 'Deterministic confidence calculation.',
        sourceRecordId: primarySource?.id,
        components: {
          sourceWeight,
          agreementScore,
          completenessScore,
          validationScore,
        },
        fieldWeight,
        confidence,
      });
    } catch (error) {
      throw new CalculatorError('Failed to calculate field confidence.', {
        candidateId: context.input.candidate.id,
        field: fieldPath,
        strategy: this.weightedStrategy.name,
        reason: 'field-confidence-calculation-failure',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
