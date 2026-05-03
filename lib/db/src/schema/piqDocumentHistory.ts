import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { piqDocumentsTable } from "./piqDocuments";
import { piqCasesTable } from "./piqCases";
import { usersTable } from "./users";

export const PIQ_DOC_ACTIONS = [
  "created",
  "edited",
  "submitted",
  "supervisor_approved",
  "supervisor_returned",
  "hr_approved",
  "hr_returned",
  "manager_accepted",
  "delivered",
  "signed",
  "closed",
] as const;
export type PiqDocAction = (typeof PIQ_DOC_ACTIONS)[number];

export const piqDocumentHistoryTable = pgTable("piq_document_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => piqDocumentsTable.id, { onDelete: "cascade" }),
  caseId: uuid("case_id").notNull().references(() => piqCasesTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  action: text("action").$type<PiqDocAction>().notNull(),
  performedBy: uuid("performed_by").references(() => usersTable.id),
  performedByRole: text("performed_by_role").notNull(),
  notes: text("notes"),
  diff: jsonb("diff"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqDocumentHistory = typeof piqDocumentHistoryTable.$inferSelect;
