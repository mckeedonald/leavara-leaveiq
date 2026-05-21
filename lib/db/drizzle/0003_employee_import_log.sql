CREATE TABLE IF NOT EXISTS "employee_import_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "filename" text,
  "uploaded_by" text,
  "total_rows" integer NOT NULL DEFAULT 0,
  "inserted" integer NOT NULL DEFAULT 0,
  "updated" integer NOT NULL DEFAULT 0,
  "errors" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'success',
  "error_csv" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "emp_import_log_org_idx" ON "employee_import_log" ("organization_id", "created_at" DESC);
