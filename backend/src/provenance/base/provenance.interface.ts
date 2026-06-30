import type { ConfidenceContext } from '../../confidence/base/confidence.context';
import type { FieldProvenanceResult } from '../../confidence/base/confidence.types';

export interface ProvenanceBuilderContract {
  buildFieldHistory(
    fieldPath: string,
    selectedValue: unknown,
    context: ConfidenceContext,
  ): FieldProvenanceResult;
}
