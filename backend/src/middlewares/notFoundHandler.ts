import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';

export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(
    new AppError(`Route not found: ${req.method} ${req.originalUrl}`, {
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
    }),
  );
}
