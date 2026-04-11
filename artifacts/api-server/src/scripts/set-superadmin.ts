import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const email = process.env["ADMIN_EMAIL"] ?? "admin@leavara.net";

const result = await db.update(usersTable)
  .set({ isSuperAdmin: true })
  .where(eq(usersTable.email, email))
  .returning({ email: usersTable.email, isSuperAdmin: usersTable.isSuperAdmin });

console.log("Updated:", result);
process.exit(0);
