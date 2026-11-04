import bcrypt from 'bcryptjs';
import { env } from '../config/env';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) issues.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) issues.push('Password must contain a number');
  return issues;
}
