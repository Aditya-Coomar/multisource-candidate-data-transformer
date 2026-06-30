import type { ConfidenceStrategy } from '../base/confidence.interface';
import type { ConfidenceContext } from '../base/confidence.context';
import { clampScore, toAgreementKey } from '../base/confidence.context';

export class AgreementStrategy implements ConfidenceStrategy {
  public readonly name = 'agreement';

  score(fieldPath: string, value: unknown, context: ConfidenceContext): number {
    const extractedValues = context.input.normalizedCandidates
      .map((candidate) => candidate.candidate[fieldPath as keyof typeof candidate.candidate])
      .filter((candidateValue) => candidateValue !== undefined);

    if (extractedValues.length <= 1) {
      return 1;
    }

    const selectedKey = toAgreementKey(value);
    const agreeingCount = extractedValues.reduce((count, candidateValue) => {
      return count + (toAgreementKey(candidateValue) === selectedKey ? 1 : 0);
    }, 0);

    return clampScore(agreeingCount / extractedValues.length);
  }
}
