/**
 * Resets the password for the super admin account.
 *
 * Run on Railway via:
 *   railway run pnpm --filter @workspace/api-server reset-superadmin-password
 *
 * Or locally (with DATABASE_URL in .env):
 *   pnpm --filter @workspace/api-server reset-superadmin-password
 *
 * Override defaults with env vars:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=NewPass123! railway run pnpm ...
 */
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const { Pool } = pg;

const email = process.env["ADMIN_EMAIL"] ?? "admin@leavara.net";
const newPassword = process.env["ADMIN_PASSWORD"] ?? "LeaveIQ2026!";

if (!process.env["DATABASE_URL"]) {
  console.error("[reset-superadmin-password] ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error("[reset-superadmin-password] ERROR: Password must be at least 8 characters.");
  process.exit(1);
}

console.log("[reset-superadmin-password] Starting password reset for:", email);

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const db = drizzle(pool);

try {
  console.log("[reset-superadmin-password] Hashing password...");
  const passwordHash = await bcrypt.hash(newPassword, 12);

  console.log("[reset-superadmin-password] Connecting to database and updating user...");
  const result = await db
    .update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .returning({ id: usersTable.id, email: usersTable.email, isSuperAdmin: usersTable.isSuperAdmin });

  if (result.length === 0) {
    console.error(`[reset-superadmin-password] ERROR: No user found with email: ${email}`);
    console.error("[reset-superadmin-password] Hint: Run the seed-admin script first to create the initial admin user.");
    await pool.end();
    process.exit(1);
  }

  console.log("[reset-superadmin-password] ✓ Password reset successfully for:", result[0]!.email);
  console.log("[reset-superadmin-password]   Super admin:", result[0]!.isSuperAdmin);
  console.log("[reset-superadmin-password] Please change this password after logging in.");
} catch (err) {
  console.error("[reset-superadmin-password] ERROR: Failed to reset password.");
  console.error(err instanceof Error ? err.message : String(err));
  await pool.end().catch(() => {});
  process.exit(1);
}

await pool.end();
process.exit(0);
