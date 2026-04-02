import { pgTable, text, uuid, boolean, date, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const leaveCasesTable = pgTable("leave_case", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id),
  caseNumber: text("case_number").unique().notNull(),
  employeeNumber: text("employee_number").notNull(),
  employeeFirstName: text("employee_first_name"),
  employeeLastName: text("employee_last_name"),
  employeeEmail: text("employee_email"),
  state: text("state").notNull().default("INTAKE"),
  requestedStart: date("requested_start").notNull(),
  requestedEnd: date("requested_end"),
  leaveReasonCategory: text("leave_reason_category").notNull(),
  intermittent: boolean("intermittent").notNull().default(false),
  analysisResult: jsonb("analysis_result"),
  aiRecommendation: jsonb("ai_recommendation"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedReason: text("deleted_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLeaveCaseSchema = createInsertSchema(leaveCasesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLeaveCase = z.infer<typeof insertLeaveCaseSchema>;
export type LeaveCase = typeof leaveCasesTable.$inferSelect;
