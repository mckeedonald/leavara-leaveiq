import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const orgLocationsTable = pgTable("org_location", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  state: text("state").notNull(),
  city: text("city"),
  county: text("county"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrgLocation = typeof orgLocationsTable.$inferSelect;
export type InsertOrgLocation = typeof orgLocationsTable.$inferInsert;
