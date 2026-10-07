import { randomUUID } from 'node:crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

const maxDocumentBytes = 8 * 1024 * 1024;
const acceptedContentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const userIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let s3: S3Client | undefined;

export async function createDocumentUpload(userId: string, contentType: string, contentLength: number) {
  if (!userIdPattern.test(userId)) throw new Error('A valid authenticated user ID is required');
  if (!acceptedContentTypes.has(contentType)) throw new Error('Unsupported document type');
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > maxDocumentBytes) {
    throw new Error('Document must be between 1 byte and 8 MB');
  }

  const bucket = process.env.AWS_S3_BUCKET;
  const kmsKeyId = process.env.AWS_S3_KMS_KEY_ID;
  const region = process.env.AWS_REGION;
  if (!bucket || !kmsKeyId || !region) throw new Error('AWS S3 bucket, region, and KMS key must be configured');

  s3 ??= new S3Client({ region });
  const key = `loan-documents/${userId}/${randomUUID()}`;
  const post = await createPresignedPost(s3, {
    Bucket: bucket,
    Key: key,
    Expires: 300,
    Fields: {
      'Content-Type': contentType,
      'x-amz-server-side-encryption': 'aws:kms',
      'x-amz-server-side-encryption-aws-kms-key-id': kmsKeyId,
    },
    Conditions: [
      ['content-length-range', 1, maxDocumentBytes + 16 * 1024],
      ['eq', '$Content-Type', contentType],
      ['eq', '$x-amz-server-side-encryption', 'aws:kms'],
      ['eq', '$x-amz-server-side-encryption-aws-kms-key-id', kmsKeyId],
    ],
  });

  return { key, ...post };
}