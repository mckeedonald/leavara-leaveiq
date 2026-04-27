import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { piqCasesTable } from "./piqCases";
import { usersTable } from "./users";

export const piqAuditLogTable = pgTable("piq_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  caseId: uuid("case_id").references(() => piqCasesTable.id),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  actorId: uuid("actor_id").references(() => usersTable.id),
  actorRole: text("actor_role"),
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqAuditLog = typeof piqAuditLogTable.$inferSelect;
