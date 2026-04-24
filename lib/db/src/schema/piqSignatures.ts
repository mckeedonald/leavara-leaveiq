import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { piqCasesTable } from "./piqCases";
import { piqEmployeesTable } from "./piqEmployees";
import { piqUsersTable } from "./piqUsers";

export const PIQ_SIGNATURE_METHODS = ["esignature", "wet_ink_scan"] as const;
export type PiqSignatureMethod = (typeof PIQ_SIGNATURE_METHODS)[number];

export const PIQ_SIGNATURE_STATUSES = [
  "pending",
  "sent",
  "viewed",
  "signed",
  "declined",
  "expired",
  "refused",
] as const;
export type PiqSignatureStatus = (typeof PIQ_SIGNATURE_STATUSES)[number];

export const piqSignaturesTable = pgTable("piq_signature", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => piqCasesTable.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => piqEmployeesTable.id),
  method: text("method").$type<PiqSignatureMethod>().notNull(),
  provider: text("provider").$type<"docusign" | "hellosign">().notNull().default("docusign"),
  providerEnvelopeId: text("provider_envelope_id"),
  status: text("status").$type<PiqSignatureStatus>().notNull().default("pending"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  documentStorageKey: text("document_storage_key"),
  refusedReason: text("refused_reason"),
  deliveredBy: uuid("delivered_by").references(() => piqUsersTable.id),
  deliveryDate: timestamp("delivery_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PiqSignature = typeof piqSignaturesTable.$inferSelect;
