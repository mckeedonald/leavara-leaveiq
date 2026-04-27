import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const UNIFIED_ROLES = ["hr_admin", "hr_user", "manager"] as const;
export type UnifiedRole = (typeof UNIFIED_ROLES)[number];

export const usersTable = pgTable("hr_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  fullName: text("full_name").notNull().default(""),
  position: text("position").default(""),
  // Unified role across LeaveIQ and PerformIQ
  role: text("role").$type<UnifiedRole>().notNull().default("hr_user"),
  // FK to org_role if using a custom role (no Drizzle-level FK to avoid circular import)
  customRoleId: uuid("custom_role_id"),
  hrisId: text("hris_id"),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HrUser = typeof usersTable.$inferSelect;
export type InsertHrUser = typeof usersTable.$inferInsert;
