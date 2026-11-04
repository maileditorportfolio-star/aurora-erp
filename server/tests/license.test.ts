import { describe, expect, it } from 'vitest';
import { verifyLicenseKey } from '../src/utils/license';

describe('license', () => {
  it('rejects malformed keys', () => {
    const status = verifyLicenseKey('not-a-license', 'AAAA');
    expect(status.valid).toBe(false);
    expect(status.reason).toBeTruthy();
  });

  it('rejects empty key', () => {
    const status = verifyLicenseKey('', 'AAAA');
    expect(status.valid).toBe(false);
  });
});