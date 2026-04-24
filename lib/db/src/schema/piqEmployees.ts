import { pgTable, text, uuid, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { piqUsersTable } from "./piqUsers";

export const piqEmployeesTable = pgTable("piq_employee", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  personalEmail: text("personal_email"),
  workEmail: text("work_email"),
  jobTitle: text("job_title"),
  department: text("department"),
  managerId: uuid("manager_id").references(() => piqUsersTable.id),
  hrisEmployeeId: text("hris_employee_id"),
  hireDate: date("hire_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqEmployee = typeof piqEmployeesTable.$inferSelect;
export type InsertPiqEmployee = typeof piqEmployeesTable.$inferInsert;
