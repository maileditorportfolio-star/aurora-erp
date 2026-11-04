import pino from 'pino';
import { env } from './env';

const transport = env.LOG_PRETTY
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    }
  : undefined;

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'aurora-erp-api', env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.refreshToken',
      'passwordHash',
      'refreshToken',
    ],
    censor: '[REDACTED]',
  },
  ...(transport ? { transport } : {}),
});

export type Logger = typeof logger;
