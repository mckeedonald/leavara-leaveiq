import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const hrisConnectionsTable = pgTable("hris_connection", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  provider: text("provider").$type<"bamboohr" | "workday" | "adp" | "rippling">().notNull(),
  credentials: text("credentials").notNull(), // AES-256 encrypted JSON blob
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HrisConnection = typeof hrisConnectionsTable.$inferSelect;
export type InsertHrisConnection = typeof hrisConnectionsTable.$inferInsert;
