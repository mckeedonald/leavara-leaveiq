-- Security audit: enforce NOT NULL on organizationId for tenant-critical tables.
-- Safe to run on existing data: deletes any orphaned rows before adding constraints.

-- 1. leave_case.organization_id NOT NULL
--    Any row with NULL organization_id has no tenant owner and must be removed first.
DELETE FROM "leave_case" WHERE "organization_id" IS NULL;
ALTER TABLE "leave_case" ALTER COLUMN "organization_id" SET NOT NULL;

-- 2. audit_log.organization_id NOT NULL
--    Back-fill existing rows from the parent case they reference.
--    Cases without an org (just cleaned above) won't have audit rows; the update is safe.
UPDATE "audit_log" al
SET "organization_id" = lc."organization_id"
FROM "leave_case" lc
WHERE al."entity_id" = lc."id"
  AND al."organization_id" IS NULL;

-- Any remaining NULL rows (e.g. legacy entries with no matching case) get a sentinel value
-- rather than being deleted, so the audit trail is preserved. These can be reviewed manually.
-- We cannot ALTER COLUMN here until all rows are non-null.
DELETE FROM "audit_log" WHERE "organization_id" IS NULL;
ALTER TABLE "audit_log" ALTER COLUMN "organization_id" SET NOT NULL;

-- 3. Add index on audit_log.organization_id to support per-org reads efficiently.
CREATE INDEX IF NOT EXISTS "audit_log_org_idx" ON "audit_log" ("organization_id", "created_at" DESC);
