import { config } from '../../config/config';

export function createOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Multisource Candidate Data Transformer API',
      version: config.app.version,
      description: 'REST API for extraction, normalization, merge, confidence, projection, and validation.',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
      },
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          responses: {
            '200': {
              description: 'Service health',
            },
          },
        },
      },
      '/api/v1/version': {
        get: {
          summary: 'Get API and pipeline versions',
          responses: {
            '200': {
              description: 'Version information',
            },
          },
        },
      },
      '/api/v1/validate-config': {
        post: {
          summary: 'Validate a projection config',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['projectionConfig'],
                  properties: {
                    projectionConfig: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Config is valid',
            },
            '422': {
              description: 'Config is invalid',
            },
          },
        },
      },
      '/api/v1/transform': {
        post: {
          summary: 'Run the end-to-end candidate transformation pipeline',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['files', 'projectionConfig'],
                  properties: {
                    files: {
                      type: 'array',
                      items: {
                        type: 'string',
                        format: 'binary',
                      },
                    },
                    projectionConfig: {
                      type: 'string',
                      description: 'JSON-encoded ProjectionConfig',
                    },
                    sources: {
                      type: 'string',
                      description: 'Optional JSON array of source descriptors matched by index or fileName',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Projected candidate output',
            },
            '400': {
              description: 'Invalid request',
            },
            '413': {
              description: 'File too large',
            },
            '415': {
              description: 'Unsupported media type',
            },
            '500': {
              description: 'Pipeline failure',
            },
          },
        },
      },
      '/api/v1/openapi.json': {
        get: {
          summary: 'OpenAPI 3.1 document',
          responses: {
            '200': {
              description: 'OpenAPI document',
            },
          },
        },
      },
      '/api/v1/docs': {
        get: {
          summary: 'Swagger UI',
          responses: {
            '200': {
              description: 'Developer documentation UI',
            },
          },
        },
      },
    },
  } as const;
}
