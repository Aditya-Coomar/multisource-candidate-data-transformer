import { mergeUniqueProvenance } from '../../mergers/base/merge.context';
import type { Provenance } from '../../models';
import type { ConfidenceContext } from '../../confidence/base/confidence.context';
import { CONFIDENCE_TOP_LEVEL_FIELDS } from '../../confidence/base/confidence.types';
import { FieldHistoryBuilder } from './field-history.builder';
import { SourceHistoryBuilder } from './source-history.builder';

export class ProvenanceBuilder {
  private readonly fieldHistoryBuilder = new FieldHistoryBuilder();
  private readonly sourceHistoryBuilder = new SourceHistoryBuilder();

  buildCandidateProvenance(context: ConfidenceContext): readonly Provenance[] {
    const fieldHistories = CONFIDENCE_TOP_LEVEL_FIELDS.map((fieldPath) =>
      this.fieldHistoryBuilder.build(
        fieldPath,
        context.input.candidate[fieldPath],
        context,
      ).entries,
    );

    return mergeUniqueProvenance([
      context.input.candidate.provenance,
      ...fieldHistories,
      this.sourceHistoryBuilder.build(context),
    ]);
  }

  buildFieldHistory(
    fieldPath: string,
    selectedValue: unknown,
    context: ConfidenceContext,
  ) {
    return this.fieldHistoryBuilder.build(fieldPath, selectedValue, context);
  }

  attachEntityProvenance<T extends { readonly provenance: readonly unknown[] }>(
    entity: T,
    fieldPath: string,
    selectedValue: unknown,
    context: ConfidenceContext,
  ): readonly Provenance[] {
    return mergeUniqueProvenance([
      entity.provenance as readonly Provenance[],
      this.fieldHistoryBuilder.build(fieldPath, selectedValue, context).entries,
    ]);
  }
}
