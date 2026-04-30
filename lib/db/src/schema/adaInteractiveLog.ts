import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { adaCasesTable } from "./adaCases";
import { usersTable } from "./users";

/**
 * Timestamped interactive process log for ADA cases.
 * Every meaningful event — HR note, employee response, meeting record,
 * physician cert status, letter sent — goes here.
 * Distinct from casual case messaging: this is the formal compliance log.
 */
export const adaInteractiveLogTable = pgTable("ada_interactive_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => adaCasesTable.id, { onDelete: "cascade" }),

  // Who created this entry
  entryType: text("entry_type").notNull(),
  // "hr_note" | "employee_response" | "meeting_record" | "physician_cert_sent" |
  // "physician_cert_received" | "accommodation_approved" | "accommodation_denied" |
  // "letter_sent" | "follow_up_scheduled" | "jan_lookup" | "ada_determination"

  authorId: uuid("author_id").references(() => usersTable.id), // null if employee
  authorName: text("author_name").notNull(),
  authorRole: text("author_role").notNull(), // "hr" | "employee" | "system"

  content: text("content").notNull(),
  metadata: text("metadata"), // JSON string for structured data (e.g., letter content, Jan results)

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AdaInteractiveLog = typeof adaInteractiveLogTable.$inferSelect;
export type InsertAdaInteractiveLog = typeof adaInteractiveLogTable.$inferInsert;
