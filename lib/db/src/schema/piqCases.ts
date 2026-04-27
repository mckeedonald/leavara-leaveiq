import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";
import { employeesTable } from "./employees";
import { piqDocumentTypesTable } from "./piqDocumentTypes";
import { piqAgentSessionsTable } from "./piqAgentSessions";

export const PIQ_CASE_STATUSES = [
  "draft",
  "supervisor_review",
  "manager_revision",
  "hr_approval",
  "delivery",
  "closed",
  "cancelled",
] as const;
export type PiqCaseStatus = (typeof PIQ_CASE_STATUSES)[number];

export const piqCasesTable = pgTable("piq_case", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  caseNumber: text("case_number").unique().notNull(),
  employeeId: uuid("employee_id").notNull().references(() => employeesTable.id),
  initiatedBy: uuid("initiated_by").notNull().references(() => usersTable.id),
  documentTypeId: uuid("document_type_id").notNull().references(() => piqDocumentTypesTable.id),
  status: text("status").$type<PiqCaseStatus>().notNull().default("draft"),
  currentAssigneeId: uuid("current_assignee_id").references(() => usersTable.id),
  agentSessionId: uuid("agent_session_id").references(() => piqAgentSessionsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqCase = typeof piqCasesTable.$inferSelect;
export type InsertPiqCase = typeof piqCasesTable.$inferInsert;
