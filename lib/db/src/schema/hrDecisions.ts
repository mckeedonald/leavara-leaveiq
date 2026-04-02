import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { leaveCasesTable } from "./leaveCases";

export const hrDecisionsTable = pgTable("hr_decision", {
  id: uuid("id").primaryKey().defaultRandom(),
  leaveCaseId: uuid("leave_case_id")
    .notNull()
    .references(() => leaveCasesTable.id, { onDelete: "cascade" }),
  decisionType: text("decision_type").notNull(),
  decidedBy: text("decided_by").notNull(),
  decisionNotes: text("decision_notes"),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHrDecisionSchema = createInsertSchema(hrDecisionsTable).omit({
  id: true,
  decidedAt: true,
});
export type InsertHrDecision = z.infer<typeof insertHrDecisionSchema>;
export type HrDecision = typeof hrDecisionsTable.$inferSelect;
