import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app';

describe('Phase 8 validation engine and REST API layer', () => {
  it('returns API and pipeline version details', async () => {
    const response = await request(app).get('/api/v1/version');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      requestId: expect.any(String),
      data: {
        apiVersion: 'v1',
        appVersion: '1.0.0',
        confidencePipelineVersion: expect.any(String),
        projectionPipelineVersion: expect.any(String),
        llmProvider: 'openrouter',
        llmDefaultModel: 'google/gemini-2.5-flash',
      },
    });
  });

  it('validates projection configs through the API', async () => {
    const response = await request(app)
      .post('/api/v1/validate-config')
      .send({
        projectionConfig: {
          id: 'f4b8d7a5-6fd6-4b9b-9fd9-8c1d8a4b0f42',
          fields: ['fullName'],
          rename: {
            fullName: 'candidate_name',
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        valid: true,
        projectionConfig: {
          fields: ['fullName'],
        },
      },
    });
  });

  it('runs the full transform pipeline for multipart uploads', async () => {
    const response = await request(app)
      .post('/api/v1/transform')
      .field(
        'projectionConfig',
        JSON.stringify({
          id: 'f4b8d7a5-6fd6-4b9b-9fd9-8c1d8a4b0f42',
          fields: ['fullName', 'skills'],
          computedFields: ['primary_email'],
          rename: {
            fullName: 'candidate_name',
            primary_email: 'contact.primary_email',
          },
          formatting: {
            skills: {
              array: 'comma-separated',
            },
          },
        }),
      )
      .attach('files', Buffer.from(
        [
          'Jane Doe',
          'Senior Backend Engineer',
          'jane@example.com',
          '+1 555 111 2222',
          'SKILLS',
          'TypeScript, Node.js',
        ].join('\n'),
      ), {
        filename: 'resume.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      requestId: expect.any(String),
      duration: expect.any(Number),
      data: {
        candidates: [
          {
            candidate_name: 'Jane Doe',
            skills: 'TypeScript, Node.js',
            contact: {
              primary_email: 'jane@example.com',
            },
          },
        ],
        summary: {
          sourceCount: 1,
          partialCandidateCount: 1,
          normalizedCandidateCount: 1,
          canonicalCandidateCount: 1,
          projectedCandidateCount: 1,
        },
      },
    });
  });

  it('uses the default assignment schema when projectionConfig is omitted', async () => {
    const response = await request(app)
      .post('/api/v1/transform')
      .attach('files', Buffer.from(
        [
          'Jane Doe',
          'Senior Backend Engineer',
          'jane@example.com',
          '+1 555 111 2222',
          'SKILLS',
          'TypeScript, Node.js',
        ].join('\n'),
      ), {
        filename: 'resume.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.data.candidates[0])).toEqual([
      'candidate_id',
      'full_name',
      'emails',
      'phones',
      'location',
      'links',
      'headline',
      'years_experience',
      'skills',
      'experience',
      'education',
      'provenance',
      'overall_confidence',
    ]);
    expect(response.body.data.candidates[0]).toMatchObject({
      full_name: 'Jane Doe',
      emails: ['jane@example.com'],
      phones: ['+15551112222'],
      headline: 'Senior Backend Engineer',
    });
  });

  it('falls back to the default assignment schema when projectionConfig is malformed', async () => {
    const response = await request(app)
      .post('/api/v1/transform')
      .field('projectionConfig', '{broken-json')
      .attach('files', Buffer.from(
        [
          'Jane Doe',
          'Senior Backend Engineer',
          'jane@example.com',
          '+1 555 111 2222',
          'SKILLS',
          'TypeScript, Node.js',
        ].join('\n'),
      ), {
        filename: 'resume.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.candidates[0]).toMatchObject({
      candidate_id: expect.any(String),
      full_name: 'Jane Doe',
      emails: ['jane@example.com'],
      phones: ['+15551112222'],
      overall_confidence: expect.any(Number),
    });
  });

  it('rejects transform requests without files', async () => {
    const response = await request(app)
      .post('/api/v1/transform')
      .field(
        'projectionConfig',
        JSON.stringify({
          id: 'f4b8d7a5-6fd6-4b9b-9fd9-8c1d8a4b0f42',
          fields: ['fullName'],
        }),
      );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'MISSING_FILES',
      },
    });
  });

  it('rejects unsupported uploads before pipeline execution', async () => {
    const response = await request(app)
      .post('/api/v1/transform')
      .field(
        'projectionConfig',
        JSON.stringify({
          id: 'f4b8d7a5-6fd6-4b9b-9fd9-8c1d8a4b0f42',
          fields: ['fullName'],
        }),
      )
      .attach('files', Buffer.from('fake-binary'), {
        filename: 'archive.zip',
        contentType: 'application/zip',
      });

    expect(response.status).toBe(415);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
      },
    });
  });

  it('serves the OpenAPI document', async () => {
    const response = await request(app).get('/api/v1/openapi.json');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      openapi: '3.1.0',
      paths: {
        '/api/v1/transform': expect.any(Object),
      },
    });
  });
});
