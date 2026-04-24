import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const PIQ_ROLES = ["manager", "supervisor", "hr_user", "hr_admin", "system_admin"] as const;
export type PiqRole = (typeof PIQ_ROLES)[number];

export const piqUsersTable = pgTable("piq_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<PiqRole>().notNull().default("manager"),
  hrisId: text("hris_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqUser = typeof piqUsersTable.$inferSelect;
export type InsertPiqUser = typeof piqUsersTable.$inferInsert;
