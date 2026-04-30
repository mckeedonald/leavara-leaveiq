import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * Tracks all government/legal sources scraped into the leave law RAG.
 * Stores the URL, content hash (for change detection), and last successful scrape.
 * If a scrape fails or content changes significantly, flagged = true for sys admin review.
 */
export const leaveKnowledgeSourcesTable = pgTable("leave_knowledge_source", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Source identification
  sourceKey: text("source_key").unique().notNull(), // e.g. "federal_fmla", "ca_cfra", "ny_pfl"
  jurisdiction: text("jurisdiction").notNull(),      // "federal" | "CA" | "NY" | ...
  lawName: text("law_name").notNull(),               // e.g. "California Family Rights Act (CFRA)"
  sourceUrl: text("source_url").notNull(),
  sourceType: text("source_type").notNull(),         // "dol" | "state_labor" | "eeoc" | "other"

  // Scrape state
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  contentHash: text("content_hash"),                 // SHA-256 of scraped content
  consecutiveFailures: text("consecutive_failures").default("0"),

  // Change detection
  flaggedForReview: boolean("flagged_for_review").default(false),
  flagReason: text("flag_reason"),                   // why flagged (url changed, scrape failed, etc.)
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),

  // Linked RAG document
  ragDocumentId: uuid("rag_document_id"),

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type LeaveKnowledgeSource = typeof leaveKnowledgeSourcesTable.$inferSelect;
export type InsertLeaveKnowledgeSource = typeof leaveKnowledgeSourcesTable.$inferInsert;
