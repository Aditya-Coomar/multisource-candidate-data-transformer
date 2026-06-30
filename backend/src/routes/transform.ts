import { Router } from 'express';
import { uploadMiddleware } from '../config/multer.config';
import {
  getDocsPage,
  getOpenApiDocument,
  getVersion,
  transformCandidates,
  validateProjectionConfigController,
} from '../controllers/transform.controller';
import {
  validateProjectionConfigRequest,
  validateTransformRequest,
} from '../middlewares/validationMiddleware';

const transformRouter = Router();

transformRouter.get('/version', getVersion);
transformRouter.get('/openapi.json', getOpenApiDocument);
transformRouter.get('/docs', getDocsPage);
transformRouter.post(
  '/validate-config',
  validateProjectionConfigRequest,
  validateProjectionConfigController,
);
transformRouter.post(
  '/transform',
  uploadMiddleware.array('files'),
  validateTransformRequest,
  transformCandidates,
);

export default transformRouter;
