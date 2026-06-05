-- Data retention mechanism: per-org configurable retention windows + employee anonymization tombstone.
-- Safe/additive: creates a new table and adds one nullable column. No data loss.

-- 1. Per-organization retention configuration. One row per org; absence = retention disabled.
CREATE TABLE IF NOT EXISTS "retention_policy" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "closed_case_retention_days" integer,
  "terminated_employee_retention_days" integer,
  "audit_log_retention_days" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "retention_policy_org_idx" ON "retention_policy" ("organization_id");

-- 2. Employee anonymization tombstone column.
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "anonymized_at" timestamptz;
