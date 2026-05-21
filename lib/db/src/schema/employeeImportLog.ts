import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const employeeImportLogTable = pgTable("employee_import_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  filename: text("filename"),
  uploadedBy: text("uploaded_by"),          // actor email / "super_admin"
  totalRows: integer("total_rows").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  errors: integer("errors").notNull().default(0),
  status: text("status").notNull().default("success"), // "success" | "partial" | "failed"
  errorCsv: text("error_csv"),              // CSV text of errors — null when no errors
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmployeeImportLog = typeof employeeImportLogTable.$inferSelect;
export type InsertEmployeeImportLog = typeof employeeImportLogTable.$inferInsert;
