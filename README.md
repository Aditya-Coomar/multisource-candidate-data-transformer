# Multisource Candidate Data Transformer

A full-stack candidate data transformation system that turns messy multi-source hiring data into one clean, explainable, ATS-style candidate profile.

The application accepts structured and unstructured sources such as resumes, recruiter notes, CSV exports, and ATS JSON blobs; extracts candidate signals; normalizes dates, phones, locations, links, skills, education, and experience; merges duplicate/conflicting records; assigns confidence; preserves provenance; and returns either the required default schema or a runtime-configured output projection.

## Demo

Use the hosted frontend here:

[https://multisource-candidate-data-transfor.vercel.app/](https://multisource-candidate-data-transfor.vercel.app/)

For the demo flow:

1. Upload one or more candidate source files.
2. Leave the projection config empty to get the default assignment schema.
3. Optionally load or paste a custom projection config to rename, select, or normalize fields.
4. Review the output in the structured view, raw JSON view, and diagnostics view.

## Sample Inputs And Outputs

### Case 1: Default Schema From Resume

<img width="543" height="407" alt="image" src="https://github.com/user-attachments/assets/06cc141e-eb3b-40e5-9833-9cecd61eee9d" />


### Case 2: Custom Projection Config

<img width="542" height="407" alt="image" src="https://github.com/user-attachments/assets/43c5853d-f580-46a5-a265-4f6f60af9802" />


### Case 3: Structured CSV with Multiple Candidates

| <img width="542" height="407" alt="image" src="https://github.com/user-attachments/assets/73dc238b-e6d1-4de5-adf4-fe231d05fd1d" /> | <img width="619" height="311" alt="image" src="https://github.com/user-attachments/assets/8b5087d1-9c37-4379-97b5-692bf7971abc" /> |
|---|---|



## What Makes This Pipeline Different

This is not only a resume parser. It is a multi-source ATS transformer with a canonical-first architecture:

- Extracts from multiple source types, including structured and unstructured inputs.
- Uses deterministic extraction plus bounded LLM refinement for contextual fields that rules alone miss.
- Normalizes values into consistent formats, including phones, dates, locations, skills, links, education, and experience.
- Merges records into one canonical candidate profile.
- Tracks provenance so each value can be traced to its source and method.
- Scores confidence at field and candidate level.
- Supports dynamic runtime projection without code changes.
- Falls back to the default schema when projection config is missing or malformed.
- Includes a dynamic frontend that can display changing response shapes safely.

## Default Output Schema

When no projection config is provided, or when the config is malformed, the backend returns the assignment default schema:

```json
{
  "candidate_id": "string",
  "full_name": "string",
  "emails": ["string"],
  "phones": ["string"],
  "location": {
    "city": "string",
    "region": "string",
    "country": "string"
  },
  "links": {
    "linkedin": "string",
    "github": "string",
    "portfolio": "string",
    "other": ["string"]
  },
  "headline": "string | null",
  "years_experience": "number | null",
  "skills": [
    {
      "name": "string",
      "confidence": "number",
      "sources": ["string"]
    }
  ],
  "experience": [
    {
      "company": "string",
      "title": "string",
      "start": "YYYY-MM",
      "end": "YYYY-MM | null",
      "summary": "string"
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "end_year": "number"
    }
  ],
  "provenance": [
    {
      "field": "string",
      "source": "string",
      "method": "string"
    }
  ],
  "overall_confidence": "number"
}
```

## Repository Structure

```text
multisource-candidate-data-transformer/
  backend/   Express + TypeScript API and transformation pipeline
  frontend/  Next.js demo UI for upload, projection config, and response viewing
```

## Backend

The backend exposes the transformation API and runs the full pipeline:

```text
detect source -> parse -> extract -> normalize -> merge -> confidence -> project -> validate
```

### Backend Features

- Express + TypeScript REST API.
- PDF, DOCX, text, CSV, and JSON parsing.
- Resume, recruiter notes, CSV, and ATS JSON extraction.
- LLM-assisted extraction refinement with graceful fallback.
- Skill canonicalization dictionary.
- Normalizers for date, phone, email, location, URL, company, education, experience, and skills.
- Candidate merge and conflict handling.
- Provenance and confidence generation.
- Runtime projection config support.
- OpenAPI document and Swagger docs endpoint.
- Console logging only, suitable for container deployments such as Fly.io.

### Backend API

Default local base URL:

```text
http://localhost:3000
```

Endpoints:

```text
GET  /health
GET  /api/v1/version
GET  /api/v1/openapi.json
GET  /api/v1/docs
POST /api/v1/validate-config
POST /api/v1/transform
```

`POST /api/v1/transform` accepts `multipart/form-data`:

```text
files              one or more uploaded source files
projectionConfig   optional JSON string
sources            optional source descriptors
llm                optional LLM runtime controls
```

### Backend Setup

```bash
cd backend
npm install
```

Create `.env`:

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
MAX_UPLOAD_SIZE=10mb
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=your_model
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

The LLM key is optional for local smoke testing. If the LLM call is unavailable, the pipeline degrades gracefully and still returns deterministic extraction output where possible.

Run locally:

```bash
npm run dev
```

Build and verify:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Frontend

The frontend is a Next.js demo workspace for running and inspecting the pipeline.

### Frontend Features

- Multi-file upload.
- Optional projection config editor.
- Sample config loader.
- Default/fallback config status display.
- Structured candidate output view.
- Raw JSON view for exact response inspection.
- Diagnostics view for warnings, LLM decisions, and explanations.
- Dynamic rendering for unknown or renamed fields.
- Safe rendering for nested objects, arrays, primitives, nulls, provenance, and confidence.

### Frontend Setup

```bash
cd frontend
npm install
```

Create `.env.local` if the backend is not running on `http://localhost:3000`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

Run locally on port `3001`:

```bash
npm run dev -- -p 3001
```

Open:

[http://localhost:3001](http://localhost:3001)

Build and verify:

```bash
npm run lint
npm run build
```

## Running The Full App Locally

Open two terminals.

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev -- -p 3001
```

Then open:

[http://localhost:3001](http://localhost:3001)

## Example Projection Config

Leave the config empty for the default schema, or provide a custom projection:

```json
{
  "fields": [
    {
      "path": "candidate_name",
      "from": "full_name",
      "type": "string",
      "required": true
    },
    {
      "path": "primary_email",
      "from": "emails[0]",
      "type": "string",
      "required": true
    },
    {
      "path": "phone",
      "from": "phones[0]",
      "type": "string",
      "normalize": "E164"
    },
    {
      "path": "skills",
      "from": "skills[].name",
      "type": "string[]",
      "normalize": "canonical"
    },
    { "path": "recent_roles", "from": "experience", "type": "object[]" }
  ],
  "include_confidence": true,
  "include_provenance": true,
  "on_missing": "null"
}
```

If this JSON is missing or malformed, the backend falls back to the default assignment schema.

## Docker Backend

From `backend/`:

```bash
docker build -t candidate_transformer .
docker run --env-file .env -p 3000:3000 candidate_transformer
```

The Docker image includes the required `resources/` directory for skill normalization.

## Demo Script

1. Open the hosted app or local frontend.
2. Upload a resume PDF or text source.
3. Keep projection config empty and run the transform.
4. Show that the default schema is returned with candidate identity, contact details, skills, experience, education, provenance, and confidence.
5. Load the sample projection config and run again.
6. Show renamed/custom fields in the structured view.
7. Switch to raw JSON to prove the exact output is preserved.
8. Paste malformed JSON into the projection config and run again.
9. Show that the system falls back to the default schema instead of failing.


## Notes For Deployment

- Frontend is deployable to Vercel.
- Backend is deployable to Fly.io or any Node.js container host.
- Logs are emitted to stdout/stderr and are safe for container runtimes.
- Configure frontend `NEXT_PUBLIC_API_BASE_URL` to point to the deployed backend.
- Configure backend `CORS_ORIGINS` to include the deployed frontend URL.
