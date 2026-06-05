import { encrypt, decrypt } from "./crypto";

/**
 * Field-level encryption helpers for sensitive PII at rest.
 *
 * Uses the AES-256-GCM helpers in crypto.ts. Because decrypt() passes through
 * any value lacking the `enc:v1:` prefix unchanged, these helpers are safe to
 * apply to legacy plaintext rows — no big-bang migration required. A one-time
 * backfill (scripts/backfillEncryption.ts) re-writes existing rows in place.
 */

// Sensitive free-text fields on adaCasesTable that may contain medical/PII detail.
export const ADA_ENCRYPTED_FIELDS = [
  "disabilityDescription",
  "functionalLimitations",
  "accommodationRequested",
  "hardshipJustification",
] as const;

type EncryptableValue = string | null | undefined;

function encField(v: EncryptableValue): EncryptableValue {
  if (v == null || v === "") return v;
  return encrypt(v);
}

function decField(v: EncryptableValue): EncryptableValue {
  if (v == null) return v;
  return decrypt(v);
}

/** Encrypt sensitive ADA fields on an object destined for insert/update. Mutates a copy. */
export function encryptAdaWrite<T extends Record<string, unknown>>(values: T): T {
  const out: Record<string, unknown> = { ...values };
  for (const f of ADA_ENCRYPTED_FIELDS) {
    if (f in out) out[f] = encField(out[f] as EncryptableValue);
  }
  return out as T;
}

/** Decrypt sensitive ADA fields on a row read from the DB. Returns null/undefined unchanged. */
export function decryptAdaRow<T extends Record<string, unknown> | null | undefined>(row: T): T {
  if (!row) return row;
  const out: Record<string, unknown> = { ...row };
  for (const f of ADA_ENCRYPTED_FIELDS) {
    if (f in out) out[f] = decField(out[f] as EncryptableValue);
  }
  return out as T;
}

/** Decrypt sensitive ADA fields on every row in an array. */
export function decryptAdaRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((r) => decryptAdaRow(r));
}

/** Encrypt a case document's inline content (medical cert bodies / base64 PDFs). */
export function encryptDocContent(content: EncryptableValue): EncryptableValue {
  return encField(content);
}

/** Decrypt a case document's inline content. */
export function decryptDocContent(content: EncryptableValue): EncryptableValue {
  return decField(content);
}
