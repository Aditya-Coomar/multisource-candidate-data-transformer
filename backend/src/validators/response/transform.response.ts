import { z } from 'zod';
import { ProjectionPlanner } from '../../projectors';
import type { ProjectionConfig } from '../../models';
import { RequestValidationError } from '../../errors';

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const projectedCandidateSchema = z.record(z.string(), jsonValueSchema);

export const transformResponseDataSchema = z.object({
  candidates: z.array(projectedCandidateSchema),
  summary: z
    .object({
      sourceCount: z.number().int().nonnegative(),
      partialCandidateCount: z.number().int().nonnegative(),
      normalizedCandidateCount: z.number().int().nonnegative(),
      canonicalCandidateCount: z.number().int().nonnegative(),
      projectedCandidateCount: z.number().int().nonnegative(),
    })
    .strict(),
});

export function validateProjectedCandidates(
  candidates: readonly Record<string, unknown>[],
  projectionConfig: ProjectionConfig,
): void {
  transformResponseDataSchema.shape.candidates.parse(candidates);

  const planner = new ProjectionPlanner();
  const plan = planner.build(projectionConfig);

  for (const candidate of candidates) {
    for (const field of plan.fields) {
      const exists = hasPath(candidate, field.outputPath);
      const value = getPath(candidate, field.outputPath);

      if (projectionConfig.missingValuePolicy === 'error' && !exists) {
        throw new RequestValidationError('Projected response is missing a required field.', {
          field: field.outputPath,
        }, 500);
      }

      if (
        projectionConfig.missingValuePolicy === 'null' &&
        !exists
      ) {
        throw new RequestValidationError('Projected response violated null missing policy.', {
          field: field.outputPath,
        }, 500);
      }

      if (exists && value === undefined) {
        throw new RequestValidationError('Projected response contains undefined values.', {
          field: field.outputPath,
        }, 500);
      }
    }
  }
}

function hasPath(payload: Record<string, unknown>, path: string): boolean {
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const segments = normalizedPath.split('.').filter(Boolean);
  let current: unknown = payload;

  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return false;
    }

    if (!(segment in (current as Record<string, unknown>))) {
      return false;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return true;
}

function getPath(payload: Record<string, unknown>, path: string): unknown {
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const segments = normalizedPath.split('.').filter(Boolean);
  let current: unknown = payload;

  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}
