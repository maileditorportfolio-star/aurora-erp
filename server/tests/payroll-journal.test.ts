import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import app from '../src/app';

describe('payroll journal posting', () => {
  const email = `pay-${Date.now()}@aurora.test`;
  const password = 'Test@12345';
  let accessToken: string;
  let slipId: string;
  const period = '2026-01';

  beforeAll(async () => {
    await connectDatabase();
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Payroll Tester',
      email,
      password,
      organizationName: 'Payroll Workspace',
    });
    accessToken = reg.body.data.accessToken;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('creates an employee with salary', async () => {
    const response = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        firstName: 'Jane',
        lastName: 'Doe',
        department: 'Engineering',
        designation: 'Developer',
        joinDate: '2025-01-01',
        salary: { basic: 5000, housingAllowance: 500, transportAllowance: 200, taxRate: 10, pensionRate: 5 },
      });
    expect(response.status).toBe(201);
  });

  it('generates payroll slips for the period', async () => {
    const response = await request(app)
      .post('/api/v1/payroll/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ period });
    expect(response.status).toBe(201);
    expect(response.body.data.created).toBeGreaterThan(0);
    slipId = response.body.data.slips[0].id ?? response.body.data.slips[0]._id;
    expect(slipId).toBeTruthy();
  });

  it('approves the payroll slip', async () => {
    const response = await request(app)
      .patch(`/api/v1/payroll/${slipId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'approved' });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('approved');
  });

  it('marks payroll as paid and posts journal', async () => {
    const response = await request(app)
      .patch(`/api/v1/payroll/${slipId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'paid' });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('paid');
    expect(response.body.data.journalPosted).toBe(true);
  });

  it('verifies a journal entry was created for payroll', async () => {
    const response = await request(app)
      .get('/api/v1/journal-entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ source: 'payroll' });
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });
});