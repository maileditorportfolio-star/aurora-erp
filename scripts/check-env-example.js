const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const checks = [
  {
    file: 'server/.env.example',
    required: [
      'MONGODB_URI',
      'MONGODB_DB',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'JWT_ACCESS_EXPIRES_IN',
      'JWT_REFRESH_EXPIRES_IN',
      'BCRYPT_ROUNDS',
      'CLIENT_URL',
      'CORS_ORIGINS',
      'LICENSE_ENFORCEMENT',
      'PORT',
      'NODE_ENV',
    ],
  },
  {
    file: 'client/.env.example',
    required: [
      'NEXT_PUBLIC_API_URL',
      'NEXT_PUBLIC_APP_NAME',
      'NEXT_PUBLIC_APP_TAGLINE',
      'NEXT_PUBLIC_DEFAULT_CURRENCY',
    ],
  },
];

let failed = false;
for (const check of checks) {
  const absolute = path.join(root, check.file);
  if (!fs.existsSync(absolute)) {
    console.error(`Missing ${check.file}`);
    failed = true;
    continue;
  }
  const content = fs.readFileSync(absolute, 'utf8');
  for (const key of check.required) {
    if (!new RegExp(`^${key}=`, 'm').test(content)) {
      console.error(`${check.file} is missing ${key}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('Environment example files look good.');
