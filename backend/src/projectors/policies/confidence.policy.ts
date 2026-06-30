import type { CanonicalCandidate, ConfidenceScore } from '../../models';

export class ConfidencePolicyEngine {
  inject(
    candidate: CanonicalCandidate,
    _outputPath: string,
    sourcePath: string,
  ): readonly ConfidenceScore[] {
    return Object.freeze(
      candidate.confidence.filter(
        (entry) =>
          entry.fieldPath === sourcePath || entry.fieldPath.startsWith(`${sourcePath}.`),
      ),
    );
  }
}
