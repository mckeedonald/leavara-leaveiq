import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { piqUsersTable } from "./piqUsers";

export const PIQ_AGENT_SESSION_STATUSES = ["active", "completed", "abandoned"] as const;
export type PiqAgentSessionStatus = (typeof PIQ_AGENT_SESSION_STATUSES)[number];

export const piqAgentSessionsTable = pgTable("piq_agent_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  initiatedBy: uuid("initiated_by").notNull().references(() => piqUsersTable.id),
  status: text("status").$type<PiqAgentSessionStatus>().notNull().default("active"),
  finalDraft: jsonb("final_draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const piqAgentMessagesTable = pgTable("piq_agent_message", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => piqAgentSessionsTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqAgentSession = typeof piqAgentSessionsTable.$inferSelect;
export type PiqAgentMessage = typeof piqAgentMessagesTable.$inferSelect;
