import { NextFunction, Request, Response } from 'express';
import {
  ALLOWED_CONTENT_TYPES,
  BODY_METHODS,
} from '../constants/http';
import { AppError } from '../errors/AppError';

export function contentTypeGuard(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!BODY_METHODS.has(req.method)) {
    next();
    return;
  }

  const contentType = req.headers['content-type'];

  if (!contentType) {
    next();
    return;
  }

  const isSupported = ALLOWED_CONTENT_TYPES.some((allowedType) =>
    contentType.includes(allowedType),
  );

  if (!isSupported) {
    next(
      new AppError('Unsupported content type.', {
        statusCode: 415,
        code: 'UNSUPPORTED_MEDIA_TYPE',
        details: {
          received: contentType,
          allowed: ALLOWED_CONTENT_TYPES,
        },
      }),
    );
    return;
  }

  next();
}
