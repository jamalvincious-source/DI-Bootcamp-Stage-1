import { createHash } from 'node:crypto';
import { Redis } from 'ioredis';

let redis: Redis | undefined;

function getRedis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is required');
  if (process.env.NODE_ENV === 'production' && !url.startsWith('rediss://')) {
    throw new Error('Redis TLS must be enabled in production');
  }
  redis ??= new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  return redis;
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function cacheLoanCalculation(input: unknown, result: unknown, ttlSeconds = 300) {
  if (ttlSeconds < 1 || ttlSeconds > 3600) throw new Error('Calculation cache TTL must be between 1 and 3600 seconds');
  const key = hash(JSON.stringify(input));
  await getRedis().set(`loan-calculation:${key}`, JSON.stringify(result), 'EX', ttlSeconds);
  return key;
}

export async function getCachedLoanCalculation<T>(input: unknown): Promise<T | undefined> {
  const value = await getRedis().get(`loan-calculation:${hash(JSON.stringify(input))}`);
  return value === null ? undefined : JSON.parse(value) as T;
}

export async function saveSession(sessionToken: string, session: unknown, ttlSeconds: number) {
  if (ttlSeconds < 1 || ttlSeconds > 86400) throw new Error('Session TTL must be between 1 and 86400 seconds');
  await getRedis().set(`session:${hash(sessionToken)}`, JSON.stringify(session), 'EX', ttlSeconds);
}

export async function getSession<T>(sessionToken: string): Promise<T | undefined> {
  const value = await getRedis().get(`session:${hash(sessionToken)}`);
  return value === null ? undefined : JSON.parse(value) as T;
}

export async function checkRedis() {
  await getRedis().ping();
}

export async function closeRedis() {
  await redis?.quit();
  redis = undefined;
}