import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);
// Mongoose 9 throws CastError when casting operator objects (e.g. { $ne: 'x' })
// on typed paths. Override casting to pass operator objects through unchanged.
const operatorKeys = ['$ne', '$in', '$nin', '$gt', '$gte', '$lt', '$lte', '$exists', '$regex'];
function isOperatorObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value as object).some((key) => operatorKeys.includes(key));
}
function passthroughCast(value: unknown) {
  if (isOperatorObject(value)) return value;
  return value;
}
mongoose.Schema.Types.String.cast(passthroughCast);
mongoose.Schema.Types.Boolean.cast(passthroughCast);
// ObjectId: keep default casting but handle operators
const originalObjectIdCast = mongoose.Schema.Types.ObjectId.cast();
mongoose.Schema.Types.ObjectId.cast((value: unknown) => {
  if (isOperatorObject(value)) return value;
  return originalObjectIdCast ? originalObjectIdCast(value) : value;
});

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (error) => logger.error({ err: error }, 'MongoDB error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB,
    autoIndex: !env.isProduction,
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 25,
  });

  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
