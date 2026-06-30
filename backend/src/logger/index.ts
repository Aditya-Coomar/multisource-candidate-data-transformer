import winston from 'winston';
import { config } from '../config/config';
import { getCorrelationId } from '../utils/requestContext';

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
  ],
});

export default logger;
