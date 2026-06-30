import type { ConfidenceStrategy } from '../base/confidence.interface';
import type { ConfidenceContext } from '../base/confidence.context';
import { getSourceWeight } from '../base/confidence.context';
import type { Provenance } from '../../models';

export class SourceStrategy implements ConfidenceStrategy {
  public readonly name = 'source';

  score(fieldPath: string, value: unknown, context: ConfidenceContext): number {
    void fieldPath;
    void value;

    const provenance = this.getFieldProvenance(fieldPath, context);
    const sourceRecord = context.input.candidate.sourceRecords.find(
      (record) =>
        record.id ===
        (provenance.find((entry) => entry.winningSourceRecordIds?.length)
          ?.winningSourceRecordIds?.[0] ?? provenance[0]?.sourceRecordId),
    );

    return getSourceWeight(sourceRecord, context);
  }

  private getFieldProvenance(
    fieldPath: string,
    context: ConfidenceContext,
  ): readonly Provenance[] {
    return context.input.candidate.provenance.filter(
      (entry) =>
        entry.fieldPath === fieldPath || entry.fieldPath.startsWith(`${fieldPath}.`),
    );
  }
}
