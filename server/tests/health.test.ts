import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import app from '../src/app';

describe('health', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('responds to GET /', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Aurora ERP');
  });

  it('responds to GET /api/v1/public/health', async () => {
    const response = await request(app).get('/api/v1/public/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});