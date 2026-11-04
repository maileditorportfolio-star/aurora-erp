import http from 'node:http';
import app from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { assertLicenseAllowsBoot } from './utils/license';

let server: http.Server | null = null;

async function start(): Promise<void> {
  try {
    assertLicenseAllowsBoot();
    await connectDatabase();

    server = app.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          environment: env.NODE_ENV,
          apiPrefix: env.API_PREFIX,
          clientUrl: env.CLIENT_URL,
        },
        `${env.APP_NAME} API listening on http://localhost:${env.PORT}${env.API_PREFIX}`,
      );
    });

    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 70_000;
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start API');
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down gracefully');
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  void shutdown('uncaughtException');
});

if (require.main === module) {
  void start();
}

export { app, start };
