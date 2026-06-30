import type { Request, Response, NextFunction } from 'express';
import { PipelineService } from '../services/pipeline.service';
import type { UploadedFile } from '../types/upload';
import { sendSuccess } from '../utils/apiResponse';
import { createOpenApiDocument } from '../validators/response/openapi.document';

const pipelineService = new PipelineService();

export async function transformCandidates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await pipelineService.transform({
      files: (Array.isArray(req.files) ? req.files : []) as UploadedFile[],
      projectionConfig: req.body.projectionConfig,
      sourceDescriptors: req.body.sources,
    });

    sendSuccess(req, res, result);
  } catch (error) {
    next(error);
  }
}

export function validateProjectionConfigController(
  req: Request,
  res: Response,
): void {
  const projectionConfig = pipelineService.validateProjectionConfig(
    req.body.projectionConfig,
  );

  sendSuccess(req, res, {
    valid: true,
    projectionConfig,
  });
}

export function getVersion(
  req: Request,
  res: Response,
): void {
  sendSuccess(req, res, pipelineService.getVersion());
}

export function getOpenApiDocument(
  _req: Request,
  res: Response,
): void {
  res.status(200).json(createOpenApiDocument());
}

export function getDocsPage(
  _req: Request,
  res: Response,
): void {
  res.status(200).type('html').send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Candidate Transformer API Docs</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
    />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api/v1/openapi.json',
        dom_id: '#swagger-ui'
      });
    </script>
  </body>
</html>`);
}
