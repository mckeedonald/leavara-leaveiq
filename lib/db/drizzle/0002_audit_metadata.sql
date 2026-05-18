ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
CREATE INDEX IF NOT EXISTS "audit_log_org_created_idx" ON "audit_log" ("organization_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_log_entity_action_idx" ON "audit_log" ("entity_id", "action");
