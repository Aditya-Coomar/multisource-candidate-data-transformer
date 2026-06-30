import type { Response } from 'express';
import type { AppRequest } from '../types/http';

export function sendSuccess<T>(
  req: AppRequest,
  res: Response,
  data: T,
  statusCode = 200,
): void {
  res.status(statusCode).json({
    success: true,
    requestId: req.correlationId,
    duration: getDurationMs(req),
    data,
  });
}

function getDurationMs(req: AppRequest): number {
  if (!req.requestStartedAt) {
    return 0;
  }

  return Number((Date.now() - req.requestStartedAt).toFixed(0));
}
