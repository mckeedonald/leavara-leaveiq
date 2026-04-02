import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const invitesTable = pgTable("hr_invite", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id),
  email: text("email").notNull(),
  role: text("role").$type<"admin" | "user">().notNull().default("user"),
  token: text("token").unique().notNull(),
  sentByUserId: uuid("sent_by_user_id").references(() => usersTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HrInvite = typeof invitesTable.$inferSelect;
