import type { ApiFailure, TransformRequest, TransformResponse } from "@/types/api";

const DEFAULT_API_BASE_URL = "http://localhost:3000";

export async function transformCandidates(
  request: TransformRequest,
): Promise<TransformResponse> {
  const formData = new FormData();

  for (const file of request.files) {
    formData.append("files", file);
  }

  const config = request.projectionConfig.trim();
  if (config) {
    formData.append("projectionConfig", config);
  }

  const response = await fetch(`${getApiBaseUrl()}/api/v1/transform`, {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => undefined)) as
    | TransformResponse
    | ApiFailure
    | undefined;

  if (!response.ok || !payload || payload.success !== true) {
    throw new Error(getErrorMessage(payload, response.status));
  }

  return payload;
}

export function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
    DEFAULT_API_BASE_URL
  );
}

function getErrorMessage(
  payload: ApiFailure | TransformResponse | undefined,
  status: number,
): string {
  if (payload?.success === true) {
    return `Transform request failed with HTTP ${status}.`;
  }

  return (
    payload?.error?.message ??
    payload?.message ??
    `Transform request failed with HTTP ${status}.`
  );
}
