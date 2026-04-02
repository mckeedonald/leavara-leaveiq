import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { logger } from "./logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 64) {
    logger.warn(
      "ENCRYPTION_KEY is not set or too short — using an ephemeral key. " +
      "Set a persistent 64-char hex ENCRYPTION_KEY secret for production.",
    );
    return randomBytes(32);
  }
  return Buffer.from(raw.slice(0, 64), "hex");
}

let _key: Buffer | null = null;
function key(): Buffer {
  if (!_key) _key = getKey();
  return _key;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]);
  return PREFIX + payload.toString("base64");
}

export function decrypt(value: string): string {
  if (!value.startsWith(PREFIX)) {
    return value;
  }
  try {
    const payload = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key(), iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    logger.error("Failed to decrypt notice content — data may be corrupt or key mismatch");
    return "[encrypted content unavailable]";
  }
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
