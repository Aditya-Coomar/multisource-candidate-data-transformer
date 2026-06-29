import { Request, Response } from 'express';
import { config } from '../config/config';

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    service: config.app.name,
    version: config.app.version,
    environment: config.env,
    timestamp: new Date().toISOString(),
  });
}
