import type { Request } from 'express';

export interface AppRequest extends Request {
  correlationId?: string;
  requestStartedAt?: number;
  files?: unknown;
}
