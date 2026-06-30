import type {
  CanonicalCandidate,
  ConfidenceScore,
  ProjectionConfig,
  ProjectionFieldFormatting,
  Provenance,
} from '../../models';

export interface ProjectionPlanField {
  readonly sourcePath: string;
  readonly outputPath: string;
  readonly formatting?: ProjectionFieldFormatting;
  readonly computed: boolean;
}

export interface ProjectionPlan {
  readonly fields: readonly ProjectionPlanField[];
  readonly missingValuePolicy: ProjectionConfig['missingValuePolicy'];
  readonly includeConfidence: boolean;
  readonly includeProvenance: boolean;
  readonly includeSourceRecords: boolean;
}

export interface ProjectionMetadata<T> {
  readonly confidence: Readonly<Record<string, readonly ConfidenceScore[]>>;
  readonly provenance: Readonly<Record<string, readonly Provenance[]>>;
  readonly output: T;
}

export interface FieldResolution {
  readonly sourcePath: string;
  readonly outputPath: string;
  readonly value: unknown;
  readonly formatting?: ProjectionFieldFormatting;
}

export interface ProjectionExecutionInput {
  readonly candidate: CanonicalCandidate;
  readonly config: ProjectionConfig;
}
