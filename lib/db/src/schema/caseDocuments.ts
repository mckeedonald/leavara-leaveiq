import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { leaveCasesTable } from "./leaveCases";

export const caseDocumentsTable = pgTable("case_document", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => leaveCasesTable.id, { onDelete: "cascade" }),
  uploadedBy: text("uploaded_by").$type<"employee" | "hr">().notNull().default("employee"),
  fileName: text("file_name").notNull(),
  storageKey: text("storage_key"), // R2 object key (nullable — inline docs skip R2)
  contentInline: text("content_inline"), // inline text content (notices stored directly in DB)
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CaseDocument = typeof caseDocumentsTable.$inferSelect;
export type InsertCaseDocument = typeof caseDocumentsTable.$inferInsert;
