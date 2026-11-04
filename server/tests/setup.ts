import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll } from 'vitest';

const mongod = await MongoMemoryServer.create();

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = mongod.getUri();
process.env.MONGODB_DB = 'aurora_test';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.LICENSE_ENFORCEMENT = 'false';

afterAll(async () => {
  await mongod.stop();
});