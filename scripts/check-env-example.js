const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const checks = [
  {
    file: 'server/.env.example',
    required: ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'],
  },
  {
    file: 'client/.env.example',
    required: ['NEXT_PUBLIC_API_URL'],
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