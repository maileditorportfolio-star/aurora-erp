import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { requestId } from './middlewares/requestId';
import { auditTrail } from './middlewares/auditTrail';
import { generalLimiter } from './middlewares/rateLimit';
import { errorHandler, notFound } from './middlewares/error';
import apiRouter from './routes';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);

app.use(requestId);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req as express.Request).requestId ?? '',
    autoLogging: {
      ignore: (req) => req.url?.includes('/health') ?? false,
    },
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req) => ({ method: req.method, url: req.url, id: req.id }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  }),
);

const allowedOrigin = (origin: string): boolean => {
  if (env.corsOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === env.TENANCY_BASE_DOMAIN) return true;
    if (url.hostname.endsWith(`.${env.TENANCY_BASE_DOMAIN}`)) return true;
  } catch {
    return false;
  }
  return false;
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Organization-Id',
      'X-Request-Id',
      'X-Refresh-Token',
      'X-Token-Delivery',
    ],
    exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
    maxAge: 86_400,
  }),
);

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(generalLimiter);
app.use(auditTrail);

app.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: env.APP_NAME,
      version: env.APP_VERSION,
      api: env.API_PREFIX,
      docs: '/api/v1/public/health',
    },
  });
});

app.use(env.API_PREFIX, apiRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
