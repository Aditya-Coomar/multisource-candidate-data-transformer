import type { CanonicalCandidate, ProjectionConfig } from '../../models';

export interface Projector<TOutput = Readonly<Record<string, unknown>>> {
  project(
    candidate: CanonicalCandidate,
    config: ProjectionConfig,
  ): TOutput;
}
