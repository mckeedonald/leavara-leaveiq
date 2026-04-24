import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { piqUsersTable, type PiqRole } from "./piqUsers";

export const piqInvitesTable = pgTable("piq_invite", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").$type<PiqRole>().notNull().default("manager"),
  token: text("token").unique().notNull(),
  sentByUserId: uuid("sent_by_user_id").references(() => piqUsersTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqInvite = typeof piqInvitesTable.$inferSelect;
