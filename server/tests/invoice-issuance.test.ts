import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import app from '../src/app';

describe('invoice issuance', () => {
  const email = `inv-${Date.now()}@aurora.test`;
  const password = 'Test@12345';
  let accessToken: string;
  let customerId: string;
  let invoiceId: string;

  beforeAll(async () => {
    await connectDatabase();
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Invoice Tester',
      email,
      password,
      organizationName: 'Invoice Workspace',
    });
    accessToken = reg.body.data.accessToken;
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('creates a customer', async () => {
    const response = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Test Customer' });
    expect(response.status).toBe(201);
    customerId = response.body.data.id ?? response.body.data._id;
    expect(customerId).toBeTruthy();
  });

  it('creates a draft invoice', async () => {
    const response = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customer: customerId,
        items: [{ description: 'Service', quantity: 1, unitPrice: 100, taxRate: 0 }],
        status: 'draft',
      });
    expect(response.status).toBe(201);
    invoiceId = response.body.data.id ?? response.body.data._id;
    expect(invoiceId).toBeTruthy();
    expect(response.body.data.status).toBe('draft');
  });

  it('issues the invoice and posts to sent status', async () => {
    const response = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/issue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('sent');
    expect(response.body.data.balance).toBeGreaterThan(0);
  });

  it('retrieves the issued invoice with sent status', async () => {
    const response = await request(app)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('sent');
  });
});