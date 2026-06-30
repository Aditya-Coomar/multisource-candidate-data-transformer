import type { ProjectionExecutionInput } from './projector.types';

export function createProjectionContext(input: ProjectionExecutionInput) {
  return Object.freeze({
    candidate: input.candidate,
    config: input.config,
  });
}
