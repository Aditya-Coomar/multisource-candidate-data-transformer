import type { CanonicalCandidate, Provenance } from '../../models';

export class ProvenancePolicyEngine {
  inject(
    candidate: CanonicalCandidate,
    _outputPath: string,
    sourcePath: string,
  ): readonly Provenance[] {
    return Object.freeze(
      candidate.provenance.filter(
        (entry) =>
          entry.fieldPath === sourcePath || entry.fieldPath.startsWith(`${sourcePath}.`),
      ),
    );
  }
}
