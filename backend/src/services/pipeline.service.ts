import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { config } from '../config/config';
import logger from '../logger';
import type { ProjectionConfig } from '../models';
import type { UploadedFile } from '../types/upload';
import type { SourceDescriptor } from '../validators/request/transform.schema';
import {
  transformResponseDataSchema,
  validateProjectedCandidates,
} from '../validators/response/transform.response';
import { validateProjectionConfig } from '../utils/validators';
import {
  ConfidenceStage,
  ExtractStage,
  MergeStage,
  NormalizeStage,
  ProjectionStage,
} from '../pipeline';
import type { IngestionSource } from '../extractors/base/extractor.types';
import { PipelineError } from '../errors';

type TransformInput = {
  readonly files: readonly UploadedFile[];
  readonly projectionConfig: unknown;
  readonly sourceDescriptors?: readonly SourceDescriptor[];
};

type TransformResult = {
  readonly candidates: readonly Readonly<Record<string, unknown>>[];
  readonly summary: {
    readonly sourceCount: number;
    readonly partialCandidateCount: number;
    readonly normalizedCandidateCount: number;
    readonly canonicalCandidateCount: number;
    readonly projectedCandidateCount: number;
  };
};

export class PipelineService {
  private readonly extractStage: ExtractStage;
  private readonly normalizeStage: NormalizeStage;
  private readonly mergeStage: MergeStage;
  private readonly confidenceStage: ConfidenceStage;
  private readonly projectionStage: ProjectionStage;

  constructor(
    extractStage = new ExtractStage(),
    normalizeStage = new NormalizeStage(),
    mergeStage = new MergeStage(),
    confidenceStage = new ConfidenceStage(),
    projectionStage = new ProjectionStage(),
  ) {
    this.extractStage = extractStage;
    this.normalizeStage = normalizeStage;
    this.mergeStage = mergeStage;
    this.confidenceStage = confidenceStage;
    this.projectionStage = projectionStage;
  }

  async transform(input: TransformInput): Promise<TransformResult> {
    try {
      const projectionConfig = validateProjectionConfig(input.projectionConfig);
      const sources = this.mapFilesToSources(
        input.files,
        input.sourceDescriptors ?? [],
      );

      logger.info('pipeline.transform.started', {
        sourceCount: sources.length,
      });

      const partialCandidates = await this.extractStage.execute(sources);
      const normalizedCandidates = await this.normalizeStage.execute(partialCandidates);
      const canonicalCandidates = await this.mergeStage.execute(normalizedCandidates);
      const enrichedCandidates = await this.confidenceStage.execute(
        canonicalCandidates,
        normalizedCandidates,
      );
      const projectedCandidates = await this.projectionStage.execute(
        enrichedCandidates,
        projectionConfig,
      );

      validateProjectedCandidates(projectedCandidates, projectionConfig);

      const result = {
        candidates: projectedCandidates,
        summary: {
          sourceCount: sources.length,
          partialCandidateCount: partialCandidates.length,
          normalizedCandidateCount: normalizedCandidates.length,
          canonicalCandidateCount: canonicalCandidates.length,
          projectedCandidateCount: projectedCandidates.length,
        },
      } as const;

      transformResponseDataSchema.parse(result);

      logger.info('pipeline.transform.completed', {
        sourceCount: sources.length,
        projectedCandidateCount: projectedCandidates.length,
      });

      return result;
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        throw error;
      }

      throw new PipelineError('Transformation pipeline failed.', {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  validateProjectionConfig(payload: unknown): ProjectionConfig {
    return validateProjectionConfig(payload);
  }

  getVersion() {
    return {
      apiVersion: config.app.apiVersion,
      appVersion: config.app.version,
      confidencePipelineVersion: config.confidence.pipelineVersion,
      projectionPipelineVersion: config.projection.pipelineVersion,
      environment: config.env,
    };
  }

  private mapFilesToSources(
    files: readonly UploadedFile[],
    sourceDescriptors: readonly SourceDescriptor[],
  ): readonly IngestionSource[] {
    return Object.freeze(
      files.map((file, index) => {
        const descriptor =
          sourceDescriptors[index] ??
          sourceDescriptors.find(
            (candidate) => candidate.fileName === file.originalname,
          );
        const sourceType =
          descriptor?.sourceType ??
          inferSourceType(file.originalname, file.mimetype);

        return Object.freeze({
          sourceId: randomUUID(),
          sourceName:
            descriptor?.sourceName ??
            path.basename(file.originalname, path.extname(file.originalname)),
          sourceType,
          fileName: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer,
          size: file.size,
          receivedAt: new Date().toISOString(),
        });
      }),
    );
  }
}

function inferSourceType(
  fileName: string,
  mimeType: string,
): IngestionSource['sourceType'] {
  const normalizedName = fileName.toLowerCase();
  const extension = path.extname(normalizedName);

  if (extension === '.csv' || mimeType === 'text/csv') {
    return 'job-board';
  }

  if (extension === '.json' || mimeType === 'application/json') {
    return 'ats';
  }

  if (normalizedName.includes('recruiter') || normalizedName.includes('notes')) {
    return 'manual';
  }

  return 'resume';
}
