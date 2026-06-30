import type { JsonObject, JsonValue } from "./json";

export type TransformSummary = {
  readonly sourceCount: number;
  readonly partialCandidateCount: number;
  readonly normalizedCandidateCount: number;
  readonly canonicalCandidateCount: number;
  readonly projectedCandidateCount: number;
};

export type TransformData = {
  readonly candidates: readonly JsonObject[];
  readonly summary: TransformSummary;
  readonly semanticWarnings?: readonly JsonValue[];
  readonly llmDecisions?: readonly JsonValue[];
  readonly explanations?: readonly JsonValue[];
};

export type ApiSuccess<T> = {
  readonly success: true;
  readonly requestId: string;
  readonly duration: number;
  readonly data: T;
};

export type ApiFailure = {
  readonly success?: false;
  readonly requestId?: string;
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly details?: JsonValue;
  };
  readonly message?: string;
};

export type TransformResponse = ApiSuccess<TransformData>;

export type TransformRequest = {
  readonly files: readonly File[];
  readonly projectionConfig: string;
};
