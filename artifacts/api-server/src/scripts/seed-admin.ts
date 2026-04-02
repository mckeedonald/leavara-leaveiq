/**
 * Run with:
 *   pnpm --filter @workspace/api-server run seed-admin
 *
 * Creates an initial administrator account if none exists.
 * Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME env vars
 * before running, or edit the defaults below.
 */
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { count } from "drizzle-orm";

const email = process.env["ADMIN_EMAIL"] ?? "admin@leavara.net";
const password = process.env["ADMIN_PASSWORD"] ?? "ChangeMe123!";
const firstName = process.env["ADMIN_FIRST_NAME"] ?? "System";
const lastName = process.env["ADMIN_LAST_NAME"] ?? "Admin";
const position = process.env["ADMIN_POSITION"] ?? "HR Administrator";

const [{ total }] = await db.select({ total: count() }).from(usersTable);

if (total > 0) {
  console.log(`✓ ${total} user(s) already exist — no seed needed.`);
  process.exit(0);
}

const passwordHash = await bcrypt.hash(password, 12);

await db.insert(usersTable).values({
  email: email.toLowerCase().trim(),
  passwordHash,
  firstName,
  lastName,
  position,
  role: "admin",
});

console.log("✓ Initial administrator created:");
console.log(`  Email:    ${email}`);
console.log(`  Password: ${password}`);
console.log("  Please change the password after first login.");
process.exit(0);
