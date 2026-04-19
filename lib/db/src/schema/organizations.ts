import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";

export const organizationsTable = pgTable("organization", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  logoStorageKey: text("logo_storage_key"),
  isActive: boolean("is_active").notNull().default(true),
  hasLeaveIq: boolean("has_leave_iq").notNull().default(true),
  hasPerformIq: boolean("has_perform_iq").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Organization = typeof organizationsTable.$inferSelect;
export type InsertOrganization = typeof organizationsTable.$inferInsert;
