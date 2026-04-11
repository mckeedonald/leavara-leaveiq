import { pgTable, text, uuid, timestamp, date, numeric, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const hrisEmployeeCacheTable = pgTable(
  "hris_employee_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    fullName: text("full_name").notNull(),
    personalEmail: text("personal_email"),
    hireDate: date("hire_date"),
    avgHoursPerWeek: numeric("avg_hours_per_week", { precision: 5, scale: 2 }),
    rawData: jsonb("raw_data"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("hris_emp_org_ext_idx").on(t.organizationId, t.externalId)],
);

export type HrisEmployeeCache = typeof hrisEmployeeCacheTable.$inferSelect;
export type InsertHrisEmployeeCache = typeof hrisEmployeeCacheTable.$inferInsert;
