import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { leaveCasesTable } from "./leaveCases";

export const caseNoticesTable = pgTable("case_notice", {
  id: uuid("id").primaryKey().defaultRandom(),
  leaveCaseId: uuid("leave_case_id").notNull().references(() => leaveCasesTable.id),
  noticeType: text("notice_type").notNull(),
  subject: text("subject").notNull(),
  draftContent: text("draft_content").notNull(),
  editedContent: text("edited_content"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentBy: text("sent_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCaseNoticeSchema = createInsertSchema(caseNoticesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCaseNotice = z.infer<typeof insertCaseNoticeSchema>;
export type CaseNotice = typeof caseNoticesTable.$inferSelect;
