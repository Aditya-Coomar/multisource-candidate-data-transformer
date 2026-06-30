import logger from '../../logger';
import type { CanonicalCandidate, ProjectionConfig } from '../../models';
import { ProjectionEngine } from '../../projectors';

export class ProjectionStage {
  private readonly projectionEngine: ProjectionEngine;

  constructor(projectionEngine = new ProjectionEngine()) {
    this.projectionEngine = projectionEngine;
  }

  async execute(
    canonicalCandidates: readonly CanonicalCandidate[],
    projectionConfig: ProjectionConfig,
  ): Promise<readonly Readonly<Record<string, unknown>>[]> {
    logger.info('projection.stage.started', {
      candidateCount: canonicalCandidates.length,
    });

    const projectedCandidates = canonicalCandidates.map((candidate) =>
      this.projectionEngine.project(candidate, projectionConfig),
    );

    logger.info('projection.stage.completed', {
      candidateCount: projectedCandidates.length,
    });

    return Object.freeze(projectedCandidates);
  }
}
