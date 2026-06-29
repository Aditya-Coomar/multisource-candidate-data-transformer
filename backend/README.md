# Multisource Candidate Data Transformer Backend

Phase 1 implements the backend foundation described in the TDD: a strict TypeScript Express service with validated environment configuration, structured Winston logging, correlation IDs, centralized error handling, a health endpoint, and test/lint scaffolding for future domain phases.

## Foundation Features

- Express + TypeScript bootstrap
- Startup environment validation with `zod`
- Security middleware with Helmet, CORS, and compression
- Structured JSON logging to console plus `logs/combined.log` and `logs/error.log`
- Correlation ID propagation for every request
- Consistent API error responses
- Graceful shutdown and unhandled process error handling
- `GET /health` readiness endpoint
- Vitest + Supertest scaffold

## Required Environment Variables

Copy `.env.example` to `.env` and provide values for:

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
MAX_UPLOAD_SIZE=10mb
```

Optional:

```env
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test
```

## API Surface

- `GET /health`
- Future routes mount under `/api/v1`
