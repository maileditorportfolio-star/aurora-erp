import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import { Types } from 'mongoose';
import { nextDocumentNumber, nextSequence, peekSequence } from '../src/utils/sequence';

describe('sequence', () => {
  const orgId = new Types.ObjectId();

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('increments document numbers', async () => {
    const first = await nextSequence(orgId, 'invoice');
    const second = await nextSequence(orgId, 'invoice');
    expect(second).toBe(first + 1);
  });

  it('formats document numbers with year', async () => {
    const number = await nextDocumentNumber(orgId, 'invoice', 'INV', { pad: 4 });
    expect(number).toMatch(/^INV-\d{4}-\d{4}$/);
  });

  it('peeks current value', async () => {
    const value = await peekSequence(orgId, 'invoice');
    expect(value).toBeGreaterThan(0);
  });
});