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
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const email = process.env["ADMIN_EMAIL"] ?? "admin@leavara.net";
const newPassword = process.env["ADMIN_PASSWORD"] ?? "LeaveIQ2026!";

if (newPassword.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(newPassword, 12);

const result = await db
  .update(usersTable)
  .set({ passwordHash, updatedAt: new Date() })
  .where(eq(usersTable.email, email.toLowerCase().trim()))
  .returning({ id: usersTable.id, email: usersTable.email, isSuperAdmin: usersTable.isSuperAdmin });

if (result.length === 0) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

console.log("Password reset successfully for:", result[0].email);
console.log("  New password:", newPassword);
console.log("  Super admin: ", result[0].isSuperAdmin);
console.log("Please change this password after logging in.");
process.exit(0);
