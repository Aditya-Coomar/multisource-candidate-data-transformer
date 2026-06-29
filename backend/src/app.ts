import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { API_V1_PREFIX } from './constants/http';
import { config } from './config/config';
import { correlationIdMiddleware } from './middlewares/correlationId';
import { contentTypeGuard } from './middlewares/contentTypeGuard';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { requestLogger } from './middlewares/requestLogger';
import apiV1Router from './routes';
import healthRouter from './routes/health';

const app = express();

app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS.'));
    },
  }),
);
app.use(compression());
app.use(correlationIdMiddleware);
app.use(contentTypeGuard);
app.use(express.json({ limit: config.maxUploadSize }));
app.use(express.urlencoded({ extended: true, limit: config.maxUploadSize }));
app.use(requestLogger);

app.use('/health', healthRouter);
app.use(API_V1_PREFIX, apiV1Router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
