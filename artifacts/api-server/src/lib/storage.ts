import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "./logger";

export function isR2Configured(): boolean {
  return !!(
    process.env["R2_ACCOUNT_ID"] &&
    process.env["R2_ACCESS_KEY_ID"] &&
    process.env["R2_SECRET_ACCESS_KEY"]
  );
}

function getS3Client(): S3Client {
  const accountId = process.env["R2_ACCOUNT_ID"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];

  if (!accountId || !accessKeyId || !secretAccessKey) {
    logger.warn("R2 credentials not configured — uploads will fall back to inline DB storage");
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

/**
 * Download an object from R2 and return it as a Buffer.
 */
export async function downloadFile(key: string): Promise<Buffer> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await client.send(command);
  const stream = response.Body;
  if (!stream) throw new Error("Empty response body from R2");
  // Convert stream to Buffer
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
