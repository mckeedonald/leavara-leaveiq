/**
 * Changes the login email for the super admin account.
 *
 * Run on Railway via:
 *   CURRENT_ADMIN_EMAIL=old@example.com NEW_ADMIN_EMAIL=admin@guildlight.co \
 *     railway run pnpm --filter @workspace/api-server set-superadmin-email
 *
 * Or locally (with DATABASE_URL in .env):
 *   CURRENT_ADMIN_EMAIL=old@example.com NEW_ADMIN_EMAIL=admin@guildlight.co \
 *     pnpm --filter @workspace/api-server set-superadmin-email
 *
 * Safety: only updates a row that is flagged isSuperAdmin. Does NOT touch the
 * password or any other field. The new email must not already be in use.
 */
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const currentEmail = (process.env["CURRENT_ADMIN_EMAIL"] ?? "").toLowerCase().trim();
const newEmail = (process.env["NEW_ADMIN_EMAIL"] ?? "admin@guildlight.co").toLowerCase().trim();

if (!currentEmail) {
  console.error("[set-superadmin-email] ERROR: Set CURRENT_ADMIN_EMAIL to the existing super admin login email.");
  process.exit(1);
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
  console.error(`[set-superadmin-email] ERROR: NEW_ADMIN_EMAIL "${newEmail}" is not a valid email.`);
  process.exit(1);
}

console.log(`[set-superadmin-email] Changing super admin login: ${currentEmail} -> ${newEmail}`);

try {
  // Look up the current account and confirm it is a super admin before touching it.
  const [existing] = await db
    .select({ id: usersTable.id, email: usersTable.email, isSuperAdmin: usersTable.isSuperAdmin })
    .from(usersTable)
    .where(eq(usersTable.email, currentEmail))
    .limit(1);

  if (!existing) {
    console.error(`[set-superadmin-email] ERROR: No user found with email: ${currentEmail}`);
    process.exit(1);
  }
  if (!existing.isSuperAdmin) {
    console.error(`[set-superadmin-email] ERROR: ${currentEmail} is not a super admin. Refusing to change a non-super-admin account.`);
    process.exit(1);
  }

  // Guard against colliding with an existing account.
  const [collision] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, newEmail))
    .limit(1);
  if (collision && collision.id !== existing.id) {
    console.error(`[set-superadmin-email] ERROR: An account with ${newEmail} already exists. Aborting.`);
    process.exit(1);
  }

  const result = await db
    .update(usersTable)
    .set({ email: newEmail, updatedAt: new Date() })
    .where(eq(usersTable.id, existing.id))
    .returning({ id: usersTable.id, email: usersTable.email, isSuperAdmin: usersTable.isSuperAdmin });

  console.log("[set-superadmin-email] ✓ Updated:", result[0]);
  console.log("[set-superadmin-email] The super admin now logs in with:", newEmail);
  console.log("[set-superadmin-email] (Password is unchanged.)");
} catch (err) {
  console.error("[set-superadmin-email] ERROR: Failed to update email.");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

process.exit(0);
