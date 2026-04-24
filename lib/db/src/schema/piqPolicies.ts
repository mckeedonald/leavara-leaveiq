import { pgTable, text, uuid, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const piqPoliciesTable = pgTable("piq_policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  policyNumber: text("policy_number"),
  effectiveDate: date("effective_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqPolicy = typeof piqPoliciesTable.$inferSelect;
export type InsertPiqPolicy = typeof piqPoliciesTable.$inferInsert;
