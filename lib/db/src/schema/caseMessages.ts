import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";

/**
 * Unified case messaging table for both LeaveIQ and PerformIQ.
 * caseId references either leaveCasesTable.id or piqCasesTable.id, determined by `product`.
 * senderType = "hr" means senderId is a usersTable.id; "employee" means the sender is the employee (identified by name).
 */
export const caseMessagesTable = pgTable("case_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  product: text("product").notNull(), // "leaveiq" | "performiq"
  caseId: uuid("case_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  senderType: text("sender_type").notNull(), // "hr" | "employee"
  senderId: uuid("sender_id"), // usersTable.id for HR senders; null for employee
  senderName: text("sender_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CaseMessage = typeof caseMessagesTable.$inferSelect;
export type InsertCaseMessage = typeof caseMessagesTable.$inferInsert;
