import { pgTable, uuid, text, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

/**
 * ADA Accommodation Cases
 * Lives in LeaveIQ as a first-class case type.
 * Tracks the full ADA interactive process from initial request → decision.
 */
export const adaCasesTable = pgTable("ada_case", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  caseNumber: text("case_number").unique().notNull(),

  // Employee info
  employeeNumber: text("employee_number").notNull(),
  employeeFirstName: text("employee_first_name"),
  employeeLastName: text("employee_last_name"),
  employeeEmail: text("employee_email"),

  // Nature of request (collected at intake, kept high-level for privacy)
  disabilityDescription: text("disability_description"),      // "nature of condition" - high level
  functionalLimitations: text("functional_limitations"),      // how it affects work
  accommodationRequested: text("accommodation_requested"),    // what they're asking for
  isTemporary: boolean("is_temporary").default(false),
  estimatedDuration: text("estimated_duration"),             // if temporary
  hasPhysicianSupport: boolean("has_physician_support"),
  additionalNotes: text("additional_notes"),

  // Workflow status
  // pending_review → physician_cert_sent → cert_received → interactive_process → decision_made → closed
  status: text("status").notNull().default("pending_review"),
  displayStatus: text("display_status"),

  // Decision
  decision: text("decision"),           // "approved" | "denied" | "approved_with_modification"
  decisionDate: date("decision_date"),
  decisionNotes: text("decision_notes"),
  hardshipJustification: text("hardship_justification"), // for denials — undue hardship basis

  // HR assignment
  assignedToUserId: uuid("assigned_to_user_id").references(() => usersTable.id),

  // Physician certification
  physicianCertSentAt: timestamp("physician_cert_sent_at", { withTimezone: true }),
  physicianCertReceivedAt: timestamp("physician_cert_received_at", { withTimezone: true }),

  // Case access token (for employee portal)
  accessToken: text("access_token").unique(),

  submittedBy: text("submitted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AdaCase = typeof adaCasesTable.$inferSelect;
export type InsertAdaCase = typeof adaCasesTable.$inferInsert;
