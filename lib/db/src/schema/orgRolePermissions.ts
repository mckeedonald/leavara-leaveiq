import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { orgRolesTable } from "./orgRoles";

/**
 * Permission key format: "{product}.{resource}.{action}"
 * LeaveIQ: leaveiq.cases.view | leaveiq.cases.manage | leaveiq.calendar.view
 *          leaveiq.employees.view | leaveiq.employees.manage
 *          leaveiq.settings.manage | leaveiq.users.manage
 * PerformIQ: performiq.cases.view | performiq.cases.create | performiq.cases.manage
 *            performiq.employees.view | performiq.employees.manage
 *            performiq.settings.manage | performiq.users.manage
 */
export const ALL_PERMISSIONS = [
  "leaveiq.cases.view",
  "leaveiq.cases.manage",
  "leaveiq.calendar.view",
  "leaveiq.employees.view",
  "leaveiq.employees.manage",
  "leaveiq.settings.manage",
  "leaveiq.users.manage",
  "performiq.cases.view",
  "performiq.cases.create",
  "performiq.cases.manage",
  "performiq.employees.view",
  "performiq.employees.manage",
  "performiq.settings.manage",
  "performiq.users.manage",
] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  hr_admin: ALL_PERMISSIONS as unknown as Permission[],
  hr_user: [
    "leaveiq.cases.view", "leaveiq.cases.manage", "leaveiq.calendar.view",
    "leaveiq.employees.view",
    "performiq.cases.view", "performiq.cases.create", "performiq.cases.manage",
    "performiq.employees.view",
  ],
  manager: [
    "leaveiq.calendar.view", "leaveiq.cases.view",
    "performiq.cases.view", "performiq.cases.create",
  ],
};

export const orgRolePermissionsTable = pgTable("org_role_permission", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgRoleId: uuid("org_role_id").notNull().references(() => orgRolesTable.id, { onDelete: "cascade" }),
  permission: text("permission").$type<Permission>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrgRolePermission = typeof orgRolePermissionsTable.$inferSelect;
