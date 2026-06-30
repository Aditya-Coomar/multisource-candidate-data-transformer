import { createDeterministicId } from '../../mergers/base/merge.context';
import { createProvenance } from '../../models';
import type { Provenance } from '../../models';
import type { ConfidenceContext } from '../../confidence/base/confidence.context';

export class SourceHistoryBuilder {
  build(context: ConfidenceContext): readonly Provenance[] {
    return Object.freeze(
      context.input.candidate.sourceRecords.map((sourceRecord) =>
        createProvenance({
          id: createDeterministicId('source-history', [
            context.input.candidate.id,
            sourceRecord.id,
          ]),
          sourceRecordId: sourceRecord.id,
          fieldPath: `sourceRecords.${sourceRecord.id}`,
          sourceName: sourceRecord.sourceName,
          extractor: sourceRecord.extractor,
          timestamp: sourceRecord.receivedAt,
          notes: `Parsed by ${sourceRecord.parser} and extracted by ${sourceRecord.extractor}.`,
          candidateSourceRecordIds: [sourceRecord.id],
        }),
      ),
    );
  }
}
