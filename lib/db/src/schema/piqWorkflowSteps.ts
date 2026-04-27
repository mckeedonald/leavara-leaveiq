import { pgTable, text, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { piqCasesTable } from "./piqCases";
import { usersTable } from "./users";

export const PIQ_STEP_TYPES = [
  "draft",
  "supervisor_review",
  "hr_approval",
  "manager_revision",
  "delivery",
] as const;
export type PiqStepType = (typeof PIQ_STEP_TYPES)[number];

export const PIQ_STEP_STATUSES = ["pending", "in_progress", "completed", "skipped", "returned"] as const;
export type PiqStepStatus = (typeof PIQ_STEP_STATUSES)[number];

export const piqWorkflowStepsTable = pgTable("piq_workflow_step", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => piqCasesTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  stepType: text("step_type").$type<PiqStepType>().notNull(),
  stepOrder: integer("step_order").notNull(),
  status: text("status").$type<PiqStepStatus>().notNull().default("pending"),
  assignedTo: uuid("assigned_to").references(() => usersTable.id),
  assignedBy: uuid("assigned_by").references(() => usersTable.id),
  completedBy: uuid("completed_by").references(() => usersTable.id),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  feedback: text("feedback"),
  reassignedFrom: uuid("reassigned_from").references(() => usersTable.id),
  reassignedReason: text("reassigned_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqWorkflowStep = typeof piqWorkflowStepsTable.$inferSelect;
export type InsertPiqWorkflowStep = typeof piqWorkflowStepsTable.$inferInsert;
