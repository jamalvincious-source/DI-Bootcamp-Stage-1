import amqp from 'amqplib';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import {
  assertAuthConfiguration,
  AuthConfigurationError,
  hasRequiredMfa,
  verifyAccessToken,
} from './auth.js';
import { checkActivityLog, closeActivityLog } from './data/activity-log.js';
import { checkPostgres, closePostgres } from './data/postgres.js';
import { checkRedis, closeRedis } from './data/redis.js';
import { eventExchange } from './events.js';
import { assertProductionSecurityConfiguration } from './security-config.js';
import { isServiceName, services } from './services.js';

function getServiceName(value: string | undefined) {
  const name = value ?? '';
  if (!isServiceName(name)) {
    throw new Error(`SERVICE_NAME must be one of: ${Object.keys(services).join(', ')}`);
  }
  return name;
}

const serviceName = getServiceName(process.env.SERVICE_NAME);
const port = Number(process.env.PORT ?? 3000);
const server = Fastify({
  bodyLimit: 1024 * 1024,
  trustProxy: false,
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.body.password',
        'req.body.nationalId',
        'req.body.email',
        'req.body.phone',
        'req.body.documents',
        'req.body.dateOfBirth',
        'req.body.address',
        'req.headers.cookie',
        'req.headers.x-api-key',
      ],
      censor: '[REDACTED]',
    },
  },
});

server.register(helmet, { contentSecurityPolicy: false });
server.register(rateLimit, { max: 120, timeWindow: '1 minute' });

server.decorateRequest('identity', null);
server.addHook('preHandler', async (request, reply) => {
  const path = request.url.split('?')[0];
  if (path === '/health' || path === '/ready') return;

  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'unauthorized' });
  }

  try {
    request.identity = await verifyAccessToken(authorization.slice('Bearer '.length));
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      request.log.error({ err: error }, 'Authentication verifier is not configured');
      return reply.code(503).send({ error: 'authentication_unavailable' });
    }
    return reply.code(401).send({ error: 'invalid_access_token' });
  }

  if (!hasRequiredMfa(request.identity)) {
    return reply.code(403).send({ error: 'mfa_required' });
  }
});

server.addHook('onSend', async (_request, reply, payload) => {
  reply.header('cache-control', 'no-store');
  return payload;
});

let brokerReady = false;
let brokerConnection: Awaited<ReturnType<typeof amqp.connect>> | undefined;
let brokerChannel: Awaited<ReturnType<Awaited<ReturnType<typeof amqp.connect>>['createConfirmChannel']>> | undefined;

server.get('/health', async () => ({
  status: 'ok',
  service: serviceName,
}));

server.get('/ready', async (request, reply) => {
  if (!brokerReady) {
    return reply.code(503).send({ status: 'not-ready', service: serviceName });
  }

  try {
    if (serviceName === 'loan-service') {
      await checkPostgres();
      await checkRedis();
    } else if (serviceName === 'user-service') {
      await checkRedis();
    } else if (serviceName === 'compliance-service') {
      await checkActivityLog();
    }
  } catch (error) {
    request.log.warn({ err: error }, 'Data store readiness check failed');
    return reply.code(503).send({ status: 'not-ready', service: serviceName });
  }

  return { status: 'ready', service: serviceName };
});

async function start() {
  assertProductionSecurityConfiguration(serviceName);
  if (process.env.NODE_ENV !== 'production') assertAuthConfiguration();
  brokerConnection = await amqp.connect(
    process.env.AMQP_URL ?? 'amqp://devuser:devpassword-change-me@rabbitmq:5672',
  );
  brokerChannel = await brokerConnection.createConfirmChannel();
  await brokerChannel.assertExchange(eventExchange, 'topic', { durable: true });
  brokerReady = true;

  brokerConnection.on('close', () => {
    brokerReady = false;
    server.log.error('RabbitMQ connection closed');
  });

  await server.listen({ host: '0.0.0.0', port });
  server.log.info({ service: serviceName, description: services[serviceName] }, 'Service started');
}

async function stop() {
  brokerReady = false;
  await server.close();
  await brokerChannel?.close();
  await brokerConnection?.close();
  if (serviceName === 'loan-service') {
    await closePostgres();
    await closeRedis();
  } else if (serviceName === 'user-service') {
    await closeRedis();
  } else if (serviceName === 'compliance-service') {
    await closeActivityLog();
  }
}

process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());

start().catch((error: unknown) => {
  server.log.error({ err: error, service: serviceName }, 'Service failed to start');
  process.exitCode = 1;
});