import { DecryptCommand, GenerateDataKeyCommand, KMSClient } from '@aws-sdk/client-kms';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const encryptionContext = { application: 'ondoa-shida', purpose: 'settings' };
const kms = new KMSClient({ region: process.env.AWS_REGION });

type EncryptedConfig = {
  version: 1;
  algorithm: 'AES-256-GCM';
  wrappedKey: string;
  iv: string;
  authTag: string;
  ciphertext: string;
};

export async function encryptConfig(settings: unknown, kmsKeyId = process.env.AWS_CONFIG_KMS_KEY_ID) {
  if (!kmsKeyId) throw new Error('AWS_CONFIG_KMS_KEY_ID is required');
  const dataKey = await kms.send(new GenerateDataKeyCommand({
    KeyId: kmsKeyId,
    KeySpec: 'AES_256',
    EncryptionContext: encryptionContext,
  }));
  if (!dataKey.Plaintext || !dataKey.CiphertextBlob) throw new Error('AWS KMS did not return a data key');

  const key = Buffer.from(dataKey.Plaintext);
  const iv = randomBytes(12);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(JSON.stringify(encryptionContext)));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(settings), 'utf8'), cipher.final()]);
    const envelope: EncryptedConfig = {
      version: 1,
      algorithm: 'AES-256-GCM',
      wrappedKey: Buffer.from(dataKey.CiphertextBlob).toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
    return JSON.stringify(envelope);
  } finally {
    key.fill(0);
    dataKey.Plaintext.fill(0);
  }
}

export async function decryptConfig<T>(encryptedJson: string): Promise<T> {
  if (Buffer.byteLength(encryptedJson, 'utf8') > 64 * 1024) throw new Error('Encrypted configuration is too large');
  const envelope = JSON.parse(encryptedJson) as EncryptedConfig;
  if (envelope.version !== 1 || envelope.algorithm !== 'AES-256-GCM') throw new Error('Unsupported encrypted configuration format');

  const dataKey = await kms.send(new DecryptCommand({
    CiphertextBlob: Buffer.from(envelope.wrappedKey, 'base64'),
    EncryptionContext: encryptionContext,
  }));
  if (!dataKey.Plaintext) throw new Error('AWS KMS could not decrypt the configuration key');

  const key = Buffer.from(dataKey.Plaintext);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(Buffer.from(JSON.stringify(encryptionContext)));
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ]);
    try {
      return JSON.parse(plaintext.toString('utf8')) as T;
    } finally {
      plaintext.fill(0);
    }
  } finally {
    key.fill(0);
    dataKey.Plaintext.fill(0);
  }
}