import { describe, expect, it } from 'vitest';
import { passwordIssues } from '../src/utils/password';

describe('passwordIssues', () => {
  it('returns no issues for a strong password', () => {
    expect(passwordIssues('StrongPass1')).toEqual([]);
  });

  it('flags short passwords', () => {
    expect(passwordIssues('Ab1')).toContain('Password must be at least 8 characters');
  });

  it('flags missing character classes', () => {
    const issues = passwordIssues('alllowercase1');
    expect(issues).toContain('Password must contain an uppercase letter');
  });
});