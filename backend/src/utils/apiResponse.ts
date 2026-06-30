import type { Request, Response } from 'express';

export function sendSuccess<T>(
  req: Request,
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

function getDurationMs(req: Request): number {
  if (!req.requestStartedAt) {
    return 0;
  }

  return Number((Date.now() - req.requestStartedAt).toFixed(0));
}
