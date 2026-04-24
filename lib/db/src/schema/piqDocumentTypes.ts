import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const PIQ_BASE_TYPES = ["coaching", "written_warning", "final_warning"] as const;
export type PiqBaseType = (typeof PIQ_BASE_TYPES)[number];

export const piqDocumentTypesTable = pgTable("piq_document_type", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  baseType: text("base_type").$type<PiqBaseType>().notNull(),
  displayLabel: text("display_label").notNull(),
  requiresSupervisorReview: boolean("requires_supervisor_review").notNull().default(false),
  supervisorReviewRequired: boolean("supervisor_review_required").notNull().default(false),
  requiresHrApproval: boolean("requires_hr_approval").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqDocumentType = typeof piqDocumentTypesTable.$inferSelect;
export type InsertPiqDocumentType = typeof piqDocumentTypesTable.$inferInsert;
