/**
 * Data-retention mechanism.
 *
 * Provides two primitive operations — anonymizeEmployee() and purgeCase() — plus
 * a runRetention() driver that applies each org's configured retention windows
 * (retention_policy table). Retention DURATIONS are a legal/compliance decision and
 * are NOT hard-coded here: the job only acts when an admin has set explicit windows
 * AND enabled the policy for that org. With no policy row (or enabled=false), nothing
 * is touched — fail-safe by default.
 *
 * Anonymize vs. purge:
 *  - anonymizeEmployee: scrubs PII on an employee record (and their cases) but keeps
 *    the row for referential integrity / aggregate reporting. Tombstoned via anonymized_at.
 *  - purgeCase: scrubs PII + deletes inline document content from a single case and
 *    tombstones it via deleted_at/deleted_reason.
 */
import {
  db,
  employeesTable,
  leaveCasesTable,
  adaCasesTable,
  caseDocumentsTable,
  auditLogTable,
  retentionPoliciesTable,
} from "@workspace/db";
import { eq, and, lt, inArray, isNull } from "drizzle-orm";
import { logger } from "./logger";

const ANON = "[anonymized]";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Anonymize a single employee record and scrub PII from their associated cases.
 * Idempotent: re-running on an already-anonymized employee is a no-op-ish overwrite.
 */
export async function anonymizeEmployee(employeeId: string): Promise<void> {
  const [emp] = await db
    .select({ id: employeesTable.id, organizationId: employeesTable.organizationId, employeeNumber: employeesTable.employeeId })
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId))
    .limit(1);
  if (!emp) {
    logger.warn({ employeeId }, "Retention: anonymizeEmployee — employee not found");
    return;
  }

  await db
    .update(employeesTable)
    .set({
      fullName: ANON,
      workEmail: null,
      personalEmail: null,
      managerName: null,
      anonymizedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(employeesTable.id, employeeId));

  // Scrub PII from this employee's cases (matched by external employee number within the org).
  if (emp.employeeNumber) {
    await db
      .update(leaveCasesTable)
      .set({ employeeFirstName: ANON, employeeLastName: ANON, employeeEmail: null, updatedAt: new Date() })
      .where(and(eq(leaveCasesTable.organizationId, emp.organizationId), eq(leaveCasesTable.employeeNumber, emp.employeeNumber)));

    await db
      .update(adaCasesTable)
      .set({ employeeFirstName: ANON, employeeLastName: ANON, employeeEmail: null, updatedAt: new Date() })
      .where(and(eq(adaCasesTable.organizationId, emp.organizationId), eq(adaCasesTable.employeeNumber, emp.employeeNumber)));
  }

  logger.info({ employeeId, org: emp.organizationId }, "Retention: employee anonymized");
}

/**
 * Purge a single leave case: null PII + analysis blobs, delete inline document content,
 * and tombstone the record. The case row itself is retained for audit/reporting.
 */
export async function purgeCase(caseId: string, reason = "retention_policy"): Promise<void> {
  const [lc] = await db
    .select({ id: leaveCasesTable.id })
    .from(leaveCasesTable)
    .where(eq(leaveCasesTable.id, caseId))
    .limit(1);
  if (!lc) {
    logger.warn({ caseId }, "Retention: purgeCase — leave case not found");
    return;
  }

  // Delete medical/document content tied to the case (the highest-sensitivity data).
  await db.delete(caseDocumentsTable).where(eq(caseDocumentsTable.caseId, caseId));

  await db
    .update(leaveCasesTable)
    .set({
      employeeFirstName: ANON,
      employeeLastName: ANON,
      employeeEmail: null,
      analysisResult: null,
      aiRecommendation: null,
      deletedAt: new Date(),
      deletedReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(leaveCasesTable.id, caseId));

  logger.info({ caseId, reason }, "Retention: leave case purged");
}

/** Purge a single ADA case: null PII + sensitive free-text, tombstone the record. */
export async function purgeAdaCase(caseId: string, reason = "retention_policy"): Promise<void> {
  const [ac] = await db
    .select({ id: adaCasesTable.id })
    .from(adaCasesTable)
    .where(eq(adaCasesTable.id, caseId))
    .limit(1);
  if (!ac) {
    logger.warn({ caseId }, "Retention: purgeAdaCase — ADA case not found");
    return;
  }

  await db
    .update(adaCasesTable)
    .set({
      employeeFirstName: ANON,
      employeeLastName: ANON,
      employeeEmail: null,
      disabilityDescription: null,
      functionalLimitations: null,
      accommodationRequested: null,
      hardshipJustification: null,
      decisionNotes: null,
      additionalNotes: null,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(adaCasesTable.id, caseId));

  logger.info({ caseId, reason }, "Retention: ADA case purged");
}

interface RetentionSummary {
  org: string;
  closedLeaveCasesPurged: number;
  closedAdaCasesPurged: number;
  employeesAnonymized: number;
  auditRowsPruned: number;
}

/**
 * Apply retention windows for every org that has an enabled policy. Returns a per-org summary.
 * Safe to run repeatedly (idempotent: already-tombstoned rows are excluded by filters).
 */
export async function runRetention(): Promise<RetentionSummary[]> {
  const policies = await db
    .select()
    .from(retentionPoliciesTable)
    .where(eq(retentionPoliciesTable.enabled, true));

  const summaries: RetentionSummary[] = [];

  for (const policy of policies) {
    const summary: RetentionSummary = {
      org: policy.organizationId,
      closedLeaveCasesPurged: 0,
      closedAdaCasesPurged: 0,
      employeesAnonymized: 0,
      auditRowsPruned: 0,
    };

    // 1. Purge closed leave cases older than the window.
    if (policy.closedCaseRetentionDays != null) {
      const cutoff = daysAgo(policy.closedCaseRetentionDays);
      const closedLeave = await db
        .select({ id: leaveCasesTable.id })
        .from(leaveCasesTable)
        .where(and(
          eq(leaveCasesTable.organizationId, policy.organizationId),
          inArray(leaveCasesTable.state, ["CLOSED", "CANCELLED"]),
          lt(leaveCasesTable.updatedAt, cutoff),
          isNull(leaveCasesTable.deletedAt),
        ));
      for (const c of closedLeave) {
        await purgeCase(c.id, "retention_policy");
        summary.closedLeaveCasesPurged++;
      }

      const closedAda = await db
        .select({ id: adaCasesTable.id })
        .from(adaCasesTable)
        .where(and(
          eq(adaCasesTable.organizationId, policy.organizationId),
          eq(adaCasesTable.status, "closed"),
          lt(adaCasesTable.updatedAt, cutoff),
          isNull(adaCasesTable.deletedAt),
        ));
      for (const c of closedAda) {
        await purgeAdaCase(c.id, "retention_policy");
        summary.closedAdaCasesPurged++;
      }
    }

    // 2. Anonymize terminated (inactive) employees older than the window.
    if (policy.terminatedEmployeeRetentionDays != null) {
      const cutoff = daysAgo(policy.terminatedEmployeeRetentionDays);
      const terminated = await db
        .select({ id: employeesTable.id })
        .from(employeesTable)
        .where(and(
          eq(employeesTable.organizationId, policy.organizationId),
          eq(employeesTable.isActive, false),
          lt(employeesTable.updatedAt, cutoff),
          isNull(employeesTable.anonymizedAt),
        ));
      for (const e of terminated) {
        await anonymizeEmployee(e.id);
        summary.employeesAnonymized++;
      }
    }

    // 3. Prune old audit-log rows.
    if (policy.auditLogRetentionDays != null) {
      const cutoff = daysAgo(policy.auditLogRetentionDays);
      const pruned = await db
        .delete(auditLogTable)
        .where(and(
          eq(auditLogTable.organizationId, policy.organizationId),
          lt(auditLogTable.createdAt, cutoff),
        ))
        .returning({ id: auditLogTable.id });
      summary.auditRowsPruned = pruned.length;
    }

    logger.info({ ...summary }, "Retention: org processed");
    summaries.push(summary);
  }

  return summaries;
}
