import { pgTable, text, uuid, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { piqEmployeesTable } from "./piqEmployees";
import { piqCasesTable } from "./piqCases";

export const piqIntegrationLogsTable = pgTable("piq_integration_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  direction: text("direction").$type<"inbound" | "outbound">().notNull(),
  provider: text("provider").notNull(),
  employeeId: uuid("employee_id").references(() => piqEmployeesTable.id),
  caseId: uuid("case_id").references(() => piqCasesTable.id),
  status: text("status").$type<"success" | "failure" | "pending">().notNull().default("pending"),
  payload: jsonb("payload"),
  error: text("error"),
  retryable: boolean("retryable").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqIntegrationLog = typeof piqIntegrationLogsTable.$inferSelect;
