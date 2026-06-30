import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { API_V1_PREFIX } from './constants/http';
import { config } from './config/config';
import { corsOptions } from './config/cors.config';
import { helmetOptions } from './config/helmet.config';
import { apiRateLimit } from './config/rate-limit.config';
import { correlationIdMiddleware } from './middlewares/correlationId';
import { contentTypeGuard } from './middlewares/contentTypeGuard';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { requestLogger } from './middlewares/requestLogger';
import apiV1Router from './routes';
import healthRouter from './routes/health';

const app = express();

app.disable('x-powered-by');

app.set('trust proxy', 1);
app.use(correlationIdMiddleware);
app.use(requestLogger);
app.use(helmet(helmetOptions));
app.use(compression());
app.use(apiRateLimit);
app.use(contentTypeGuard);
app.use(express.json({ limit: config.maxUploadSize }));
app.use(express.urlencoded({ extended: true, limit: config.maxUploadSize }));

app.use('/health', healthRouter);
app.use(API_V1_PREFIX, apiV1Router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
