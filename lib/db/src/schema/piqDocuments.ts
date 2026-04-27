import { pgTable, text, uuid, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { piqCasesTable } from "./piqCases";
import { usersTable } from "./users";

/**
 * Document content JSONB shape — all fields are text for rich-text editing.
 */
export interface PiqDocumentContent {
  employeeInfo: {
    fullName: string;
    jobTitle: string;
    department: string;
    hireDate: string;
    managerName: string;
  };
  documentTypePurpose: string;
  incidentDescription: string;
  policyViolations: string;
  impactConsequences: string;
  priorDisciplineHistory: string;
  expectationsGoingForward: string;
  failureConsequences: string;
  additionalNotes: string;
}

export const piqDocumentsTable = pgTable("piq_document", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => piqCasesTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  content: jsonb("content").notNull().$type<PiqDocumentContent>(),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  isCurrent: boolean("is_current").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqDocument = typeof piqDocumentsTable.$inferSelect;
export type InsertPiqDocument = typeof piqDocumentsTable.$inferInsert;
