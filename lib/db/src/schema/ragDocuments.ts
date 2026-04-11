import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const ragDocumentsTable = pgTable("rag_document", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  fullText: text("full_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ragChunksTable = pgTable("rag_chunk", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => ragDocumentsTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RagDocument = typeof ragDocumentsTable.$inferSelect;
export type InsertRagDocument = typeof ragDocumentsTable.$inferInsert;
export type RagChunk = typeof ragChunksTable.$inferSelect;
export type InsertRagChunk = typeof ragChunksTable.$inferInsert;
