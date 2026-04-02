import { db, ragDocumentsTable, ragChunksTable } from "@workspace/db";
import { eq, sql, and, isNull } from "drizzle-orm";
import { logger } from "./logger";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;
const TOP_K = 6;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");

  while (start < normalized.length) {
    let end = start + CHUNK_SIZE;
    if (end < normalized.length) {
      const breakAt = normalized.lastIndexOf("\n\n", end);
      if (breakAt > start + CHUNK_SIZE / 2) end = breakAt;
      else {
        const sentenceBreak = normalized.lastIndexOf(". ", end);
        if (sentenceBreak > start + CHUNK_SIZE / 2) end = sentenceBreak + 1;
      }
    } else {
      end = normalized.length;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start = Math.max(start + 1, end - CHUNK_OVERLAP);
  }

  return chunks;
}

export async function ingestDocument(opts: {
  name: string;
  sourceType: string;
  fullText: string;
  organizationId: string | null;
}): Promise<string> {
  const { name, sourceType, fullText, organizationId } = opts;

  const [existing] = await db
    .select({ id: ragDocumentsTable.id })
    .from(ragDocumentsTable)
    .where(
      and(
        eq(ragDocumentsTable.name, name),
        organizationId
          ? eq(ragDocumentsTable.organizationId, organizationId)
          : isNull(ragDocumentsTable.organizationId),
      ),
    );

  if (existing) {
    await db.delete(ragChunksTable).where(eq(ragChunksTable.documentId, existing.id));
    await db
      .update(ragDocumentsTable)
      .set({ fullText, updatedAt: new Date() })
      .where(eq(ragDocumentsTable.id, existing.id));
  }

  const docId = existing?.id ?? (
    await db
      .insert(ragDocumentsTable)
      .values({ name, sourceType, fullText, organizationId })
      .returning({ id: ragDocumentsTable.id })
  )[0]!.id;

  const chunks = chunkText(fullText);
  logger.info({ docId, chunkCount: chunks.length, name }, "Storing document chunks");

  const BATCH = 50;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    await db.insert(ragChunksTable).values(
      batch.map((content, j) => ({
        documentId: docId,
        organizationId,
        chunkIndex: i + j,
        content,
      })),
    );
  }

  logger.info({ docId, name }, "Document ingestion complete");
  return docId;
}

export async function retrieveRelevantChunks(
  query: string,
  organizationId: string | null,
  topK = TOP_K,
): Promise<string[]> {
  try {
    const rows = await db.execute(sql`
      SELECT content,
             ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${query})) AS rank
      FROM rag_chunk
      WHERE (organization_id = ${organizationId} OR organization_id IS NULL)
        AND to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${topK}
    `);

    const results = rows.rows as { content: string; rank: number }[];
    if (results.length === 0) {
      // Fallback: just return the most recent chunks from this org's documents
      // when no FTS matches (e.g., query terms are very generic)
      const fallback = await db.execute(sql`
        SELECT content
        FROM rag_chunk
        WHERE organization_id IS NULL
        ORDER BY created_at DESC
        LIMIT ${Math.ceil(topK / 2)}
      `);
      return (fallback.rows as { content: string }[]).map((r) => r.content);
    }

    return results.map((r) => r.content);
  } catch (err) {
    logger.warn({ err }, "FTS retrieval failed — returning empty context");
    return [];
  }
}
