import { AuthConfigurationError, assertAuthConfiguration } from './auth.js';
import type { ServiceName } from './services.js';

function requireUrl(name: string, protocols: string[]) {
  const value = process.env[name];
  if (!value) throw new AuthConfigurationError(`${name} is required in production`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AuthConfigurationError(`${name} must be a valid URL`);
  }

  if (!protocols.includes(url.protocol)) {
    throw new AuthConfigurationError(`${name} must use ${protocols.join(' or ')}`);
  }
  return url;
}

export function assertProductionSecurityConfiguration(serviceName: ServiceName) {
  if (process.env.NODE_ENV !== 'production') return;

  assertAuthConfiguration();
  requireUrl('AMQP_URL', ['amqps:']);

  if (serviceName === 'loan-service') {
    const databaseUrl = requireUrl('DATABASE_URL', ['postgres:', 'postgresql:']);
    if (databaseUrl.searchParams.get('sslmode') !== 'verify-full') {
      throw new AuthConfigurationError('DATABASE_URL must use sslmode=verify-full');
    }
    requireUrl('REDIS_URL', ['rediss:']);

    for (const name of ['AWS_REGION', 'AWS_S3_BUCKET', 'AWS_S3_KMS_KEY_ID', 'AWS_CONFIG_KMS_KEY_ID']) {
      if (!process.env[name]) throw new AuthConfigurationError(`${name} is required in production`);
    }
  }

  if (serviceName === 'user-service') requireUrl('REDIS_URL', ['rediss:']);

  if (serviceName === 'compliance-service') {
    const mongoUrl = requireUrl('MONGODB_URI', ['mongodb:', 'mongodb+srv:']);
    if (mongoUrl.protocol === 'mongodb:' && mongoUrl.searchParams.get('tls') !== 'true') {
      throw new AuthConfigurationError('MONGODB_URI must enable tls=true in production');
    }
  }
}