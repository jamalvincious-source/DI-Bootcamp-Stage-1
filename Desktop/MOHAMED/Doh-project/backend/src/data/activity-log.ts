import { MongoClient, type Document } from 'mongodb';

export type ActivityRecord = {
  userId: string;
  action: string;
  requestId: string;
  metadata?: {
    resourceId?: string;
    outcome?: 'success' | 'failure' | 'pending';
  };
};

let client: MongoClient | undefined;
let initialized: Promise<void> | undefined;

async function getCollection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  if (process.env.NODE_ENV === 'production' && !uri.includes('tls=true') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('MongoDB TLS must be enabled in production');
  }

  client ??= new MongoClient(uri, {
    maxPoolSize: 10,
    tls: process.env.NODE_ENV === 'production',
  });
  initialized ??= client.connect().then(async () => {
    await client?.db('ondoa').collection('user_activity').createIndex({ userId: 1, occurredAt: -1 });
  });
  await initialized;
  return client.db('ondoa').collection<ActivityRecord & Document>('user_activity');
}

export async function recordActivity(record: ActivityRecord) {
  const collection = await getCollection();
  await collection.insertOne({ ...record, occurredAt: new Date() });
}

export async function checkActivityLog() {
  await getCollection();
  if (!client) throw new Error('MongoDB client is not initialized');
  await client.db('admin').command({ ping: 1 });
}

export async function closeActivityLog() {
  await client?.close();
  client = undefined;
  initialized = undefined;
}