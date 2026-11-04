import { describe, expect, it, vi } from 'vitest';
import { asyncHandler } from '../src/utils/asyncHandler';

describe('asyncHandler', () => {
  it('calls next with caught errors', async () => {
    const next = vi.fn();
    const req = {} as never;
    const res = {} as never;
    const handler = asyncHandler(async () => {
      throw new Error('boom');
    });

    handler(req, res, next);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('does nothing after success', async () => {
    const next = vi.fn();
    const req = {} as never;
    const res = { send: vi.fn() } as never;
    const handler = asyncHandler(async (_req, response) => {
      (response as { send: (value: string) => void }).send('ok');
    });

    handler(req, res, next);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(next).not.toHaveBeenCalled();
  });
});