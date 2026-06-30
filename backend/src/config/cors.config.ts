import type { CorsOptions } from 'cors';
import { config } from './config';

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin is not allowed by CORS.'));
  },
};
