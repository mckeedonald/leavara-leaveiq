/**
 * One-time backfill: encrypt existing plaintext PII at rest.
 *
 * Encrypts the sensitive ADA case free-text fields and case-document inline
 * content that were written before field-level encryption was introduced.
 *
 * Idempotent: values already carrying the `enc:v1:` prefix are skipped, so this
 * is safe to re-run. Requires ENCRYPTION_KEY to be set to the SAME persistent
 * key the application uses — otherwise newly encrypted rows will be unreadable.
 *
 * Run:  pnpm --filter @workspace/api-server backfill-encryption
 *   or: tsx --env-file-if-exists=.env src/scripts/backfillEncryption.ts
 */
import { db, adaCasesTable, caseDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encrypt, isEncrypted } from "../lib/crypto";
import { ADA_ENCRYPTED_FIELDS } from "../lib/encryptedFields";

if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 64) {
  console.error(
    "ERROR: ENCRYPTION_KEY is not set (or is shorter than 64 hex chars).\n" +
    "Set the SAME persistent key the app uses before running this backfill, " +
    "otherwise the encrypted rows will be unreadable in production.",
  );
  process.exit(1);
}

function maybeEncrypt(v: string | null | undefined): { changed: boolean; value: string | null | undefined } {
  if (v == null || v === "" || isEncrypted(v)) return { changed: false, value: v };
  return { changed: true, value: encrypt(v) };
}

async function backfillAdaCases(): Promise<void> {
  const rows = await db.select().from(adaCasesTable);
  let updated = 0;
  for (const row of rows) {
    const updates: Record<string, unknown> = {};
    for (const f of ADA_ENCRYPTED_FIELDS) {
      const { changed, value } = maybeEncrypt((row as Record<string, unknown>)[f] as string | null | undefined);
      if (changed) updates[f] = value;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(adaCasesTable).set(updates).where(eq(adaCasesTable.id, row.id));
      updated++;
    }
  }
  console.log(`ADA cases: ${updated} row(s) encrypted of ${rows.length} scanned.`);
}

async function backfillCaseDocuments(): Promise<void> {
  const rows = await db
    .select({ id: caseDocumentsTable.id, contentInline: caseDocumentsTable.contentInline })
    .from(caseDocumentsTable);
  let updated = 0;
  for (const row of rows) {
    const { changed, value } = maybeEncrypt(row.contentInline);
    if (changed) {
      await db.update(caseDocumentsTable).set({ contentInline: value as string }).where(eq(caseDocumentsTable.id, row.id));
      updated++;
    }
  }
  console.log(`Case documents: ${updated} row(s) encrypted of ${rows.length} scanned.`);
}

await backfillAdaCases();
await backfillCaseDocuments();
console.log("Backfill complete.");
process.exit(0);
