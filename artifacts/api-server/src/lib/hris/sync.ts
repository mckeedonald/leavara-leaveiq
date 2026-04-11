import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { hrisConnectionsTable, hrisEmployeeCacheTable } from "@workspace/db/schema";
import { getAdapter } from "./index";
import { logger } from "../logger";
import type { HrisEmployee } from "./types";

export async function syncHrisEmployees(organizationId: string): Promise<number> {
  const [connection] = await db
    .select()
    .from(hrisConnectionsTable)
    .where(eq(hrisConnectionsTable.organizationId, organizationId))
    .limit(1);

  if (!connection) {
    throw new Error("No HRIS connection configured for this organization.");
  }

  const adapter = getAdapter(connection.provider, connection.credentials);
  const employees: HrisEmployee[] = await adapter.syncEmployees();

  logger.info({ organizationId, count: employees.length }, "HRIS sync: employees fetched");

  // Upsert all employees
  for (const emp of employees) {
    await db
      .insert(hrisEmployeeCacheTable)
      .values({
        organizationId,
        externalId: emp.externalId,
        fullName: emp.fullName,
        personalEmail: emp.personalEmail ?? undefined,
        hireDate: emp.hireDate ?? undefined,
        avgHoursPerWeek: emp.avgHoursPerWeek !== null ? String(emp.avgHoursPerWeek) : undefined,
        rawData: emp.rawData,
        lastSyncAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [hrisEmployeeCacheTable.organizationId, hrisEmployeeCacheTable.externalId],
        set: {
          fullName: emp.fullName,
          personalEmail: emp.personalEmail ?? undefined,
          hireDate: emp.hireDate ?? undefined,
          avgHoursPerWeek: emp.avgHoursPerWeek !== null ? String(emp.avgHoursPerWeek) : undefined,
          rawData: emp.rawData,
          lastSyncAt: new Date(),
        },
      });
  }

  // Update lastSyncAt on connection
  await db
    .update(hrisConnectionsTable)
    .set({ lastSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(hrisConnectionsTable.id, connection.id));

  logger.info({ organizationId, count: employees.length }, "HRIS sync complete");
  return employees.length;
}
