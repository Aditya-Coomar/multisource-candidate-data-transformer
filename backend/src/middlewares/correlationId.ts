import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from '../utils/requestContext';

const CORRELATION_ID_HEADER = 'x-correlation-id';

export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const correlationId =
    req.header(CORRELATION_ID_HEADER)?.trim() || randomUUID();

  req.correlationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  runWithRequestContext({ correlationId }, () => next());
}
