import { Router } from 'express';
import transformRouter from './transform';

const apiV1Router = Router();
apiV1Router.use('/', transformRouter);

export default apiV1Router;
