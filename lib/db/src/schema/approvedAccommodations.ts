import { pgTable, uuid, text, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { adaCasesTable } from "./adaCases";

/**
 * Approved accommodations — one row per distinct accommodation granted.
 * Multiple accommodations can be approved on a single ADA case.
 * Ongoing accommodations have no endDate.
 */
export const approvedAccommodationsTable = pgTable("approved_accommodation", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => adaCasesTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull(),

  description: text("description").notNull(),     // e.g. "Adjustable standing desk"
  category: text("category"),                      // e.g. "ergonomic", "schedule", "remote_work"
  startDate: date("start_date"),
  endDate: date("end_date"),                       // null = ongoing
  isOngoing: boolean("is_ongoing").notNull().default(true),

  // Calendar display label (employee name + " — Reasonable Accommodation")
  calendarLabel: text("calendar_label"),

  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ApprovedAccommodation = typeof approvedAccommodationsTable.$inferSelect;
export type InsertApprovedAccommodation = typeof approvedAccommodationsTable.$inferInsert;
