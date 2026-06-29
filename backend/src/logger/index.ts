import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';
import { config } from '../config/config';
import { getCorrelationId } from '../utils/requestContext';

const logDirectory = path.resolve(process.cwd(), 'logs');
fs.mkdirSync(logDirectory, { recursive: true });

const attachRequestContext = winston.format((info) => {
  const correlationId = getCorrelationId();

  if (correlationId) {
    info.correlationId = correlationId;
  }

  return info;
});

const jsonFormat = winston.format.combine(
  attachRequestContext(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const logger = winston.createLogger({
  level: config.logLevel,
  defaultMeta: {
    service: config.app.name,
    environment: config.env,
  },
  format: jsonFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(logDirectory, 'combined.log'),
    }),
    new winston.transports.File({
      filename: path.join(logDirectory, 'error.log'),
      level: 'error',
    }),
  ],
});

export default logger;
