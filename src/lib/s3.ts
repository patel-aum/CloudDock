import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

export const BUCKET_NAME = 'aums-cloud';
export const MAX_FREE_STORAGE = 5 * 1024 * 1024 * 1024; // 5GB in bytes
export const formatStorageUsed = (bytes: number) => {
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  } else {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  }
};

export { s3Client, getSignedUrl };