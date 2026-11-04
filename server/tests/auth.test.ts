import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import app from '../src/app';

describe('auth', () => {
  const email = `tester-${Date.now()}@aurora.test`;
  const password = 'Test@12345';
  let accessToken: string;

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('registers a new account and workspace', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email,
      password,
      organizationName: 'Test Workspace',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.body.data.user.email).toBe(email);
    accessToken = response.body.data.accessToken;
  });

  it('logs in with the registered credentials', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email,
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeTruthy();
    accessToken = response.body.data.accessToken;
  });

  it('returns the current user for a valid access token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.activeOrganization).toBeTruthy();
  });

  it('rejects an invalid access token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(response.status).toBe(401);
  });
});