import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "./logger";

function getS3Client(): S3Client {
  const accountId = process.env["R2_ACCOUNT_ID"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];

  if (!accountId || !accessKeyId || !secretAccessKey) {
    logger.warn("R2 credentials not configured — file uploads will fail");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId ?? "placeholder"}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId ?? "",
      secretAccessKey: secretAccessKey ?? "",
    },
  });
}

const client = getS3Client();
const BUCKET = process.env["R2_BUCKET_NAME"] ?? "leaveiq-documents";

/**
 * Upload a file buffer to Cloudflare R2 and return the storage key.
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );
  logger.info({ key, bucket: BUCKET }, "File uploaded to R2");
  return key;
}

/**
 * Generate a short-lived presigned URL for downloading a file from R2.
 */
export async function getPresignedUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  );
  return url;
}
