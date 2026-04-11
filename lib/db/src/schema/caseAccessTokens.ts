import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { leaveCasesTable } from "./leaveCases";

export const caseAccessTokensTable = pgTable("case_access_token", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => leaveCasesTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  employeeEmail: text("employee_email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CaseAccessToken = typeof caseAccessTokensTable.$inferSelect;
export type InsertCaseAccessToken = typeof caseAccessTokensTable.$inferInsert;
