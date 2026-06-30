import { NextFunction, Request, Response } from 'express';
import logger from '../logger';
import { redactHeaders } from '../utils/redaction';

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  req.requestStartedAt = Date.now();
  const startedAt = process.hrtime.bigint();
  const headers = Object.entries(req.headers).reduce<
    Record<string, string | string[] | undefined>
  >((accumulator, [key, value]) => {
    accumulator[key] = value;
    return accumulator;
  }, {});

  logger.info('request.started', {
    method: req.method,
    path: req.originalUrl,
    headers: redactHeaders(headers),
  });

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    logger.info('request.completed', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
}
