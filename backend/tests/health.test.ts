import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';

describe('GET /health', () => {
  it('returns a healthy response', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'multisource-candidate-data-transformer-backend',
      environment: expect.any(String),
      version: '1.0.0',
    });
    expect(response.headers['x-correlation-id']).toBeDefined();
  });
});
