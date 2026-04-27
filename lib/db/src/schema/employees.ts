import { pgTable, text, uuid, boolean, timestamp, date, numeric } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const DATA_SOURCES = ["hris", "csv", "manual"] as const;
export type EmployeeDataSource = (typeof DATA_SOURCES)[number];

export const employeesTable = pgTable("employee", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  // External HR identifier (from HRIS or CSV)
  employeeId: text("employee_id"),
  fullName: text("full_name").notNull(),
  position: text("position"),
  location: text("location"),
  department: text("department"),
  // Self-referential manager relationship
  managerId: uuid("manager_id"),   // FK to employees.id — set at app level to avoid circular schema
  managerName: text("manager_name"), // denormalized from CSV/HRIS
  startDate: date("start_date"),
  // Weekly average hours worked over last 365 days — refreshed each data transfer
  avgHoursWorked: numeric("avg_hours_worked", { precision: 5, scale: 2 }),
  workEmail: text("work_email"),
  personalEmail: text("personal_email"),
  isActive: boolean("is_active").notNull().default(true),
  // FK to hr_user if this employee has a portal/system account
  linkedUserId: uuid("linked_user_id"),
  dataSource: text("data_source").$type<EmployeeDataSource>().notNull().default("manual"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  hrisId: text("hris_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Employee = typeof employeesTable.$inferSelect;
export type InsertEmployee = typeof employeesTable.$inferInsert;
