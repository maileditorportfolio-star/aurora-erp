import { subMonths } from 'date-fns';
import { User } from '../../src/models';

export const fresh = process.argv.includes('--fresh');
export const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@12345';

export function dateInMonths(monthsAgo: number, day = 12): Date {
  const base = subMonths(new Date(), monthsAgo);
  base.setUTCDate(day);
  base.setUTCHours(10, 0, 0, 0);
  return base;
}

export function randomBetween(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

export async function createUser(
  name: string,
  email: string,
  isSuperAdmin = false,
  jobTitle?: string,
) {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({
    name,
    email,
    passwordHash: await import('../../src/utils/password').then((mod) => mod.hashPassword(PASSWORD)),
    isSuperAdmin,
    status: 'active',
    jobTitle,
    lastLoginAt: new Date(),
  });
}
