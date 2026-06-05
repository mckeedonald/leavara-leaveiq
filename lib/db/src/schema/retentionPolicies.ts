import { pgTable, uuid, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

/**
 * Per-organization data-retention configuration.
 *
 * The retention mechanism (lib/retention.ts + the scheduled runner) reads these
 * windows to decide when to anonymize terminated employees, purge closed cases,
 * and prune audit logs. A NULL window means "retain indefinitely" — i.e. the
 * automated job skips that category until an admin sets an explicit value.
 *
 * Durations themselves are a legal/compliance decision (FMLA records, ADA records,
 * and state laws impose minimums) and are intentionally left unset by default —
 * see NEEDS HUMAN DECISION in the security audit.
 */
export const retentionPoliciesTable = pgTable("retention_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),

  // Master switch — when false, the scheduled job does nothing for this org.
  enabled: boolean("enabled").notNull().default(false),

  // Days after a leave/ADA case is closed before its PII is purged (record tombstoned).
  closedCaseRetentionDays: integer("closed_case_retention_days"),

  // Days after an employee is marked inactive (terminated) before their record is anonymized.
  terminatedEmployeeRetentionDays: integer("terminated_employee_retention_days"),

  // Days to keep audit-log rows before pruning.
  auditLogRetentionDays: integer("audit_log_retention_days"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RetentionPolicy = typeof retentionPoliciesTable.$inferSelect;
export type InsertRetentionPolicy = typeof retentionPoliciesTable.$inferInsert;
