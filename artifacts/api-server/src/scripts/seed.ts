/**
 * Synthetic Guildlight demo seed.
 *
 * Run with:
 *   pnpm --filter @workspace/api-server run db:seed
 *
 * Creates one fictional demo organization ("Guildlight Demo Co"), an
 * org-scoped HR admin, and a small roster of SYNTHETIC employees so a fresh
 * dev/staging database has something to look at. All data here is invented —
 * no real people, no tenant data. Safe to run repeatedly: it is idempotent on
 * the demo org slug and exits early if that org already exists.
 *
 * Intended for DEVELOPMENT / STAGING only. Do not run against production.
 *
 * Configure the admin via env (optional):
 *   SEED_ADMIN_EMAIL (default demo.admin@guildlight.co)
 *   SEED_ADMIN_PASSWORD (default GuildlightDemo123!)
 */
import bcrypt from "bcryptjs";
import { db, organizationsTable, usersTable, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEMO_SLUG = "guildlight-demo";
const adminEmail = (process.env["SEED_ADMIN_EMAIL"] ?? "demo.admin@guildlight.co").toLowerCase().trim();
const adminPassword = process.env["SEED_ADMIN_PASSWORD"] ?? "GuildlightDemo123!";

if (process.env["NODE_ENV"] === "production") {
  console.error("✗ Refusing to run the demo seed with NODE_ENV=production.");
  process.exit(1);
}

const [existing] = await db
  .select({ id: organizationsTable.id })
  .from(organizationsTable)
  .where(eq(organizationsTable.slug, DEMO_SLUG))
  .limit(1);

if (existing) {
  console.log(`✓ Demo org "${DEMO_SLUG}" already exists — nothing to seed.`);
  process.exit(0);
}

// --- Organization ---------------------------------------------------------
const [org] = await db
  .insert(organizationsTable)
  .values({
    name: "Guildlight Demo Co",
    slug: DEMO_SLUG,
    hasLeaveIq: true,
    hasPerformIq: true,
  })
  .returning();

// --- HR admin (org-scoped, not super admin) -------------------------------
const passwordHash = await bcrypt.hash(adminPassword, 12);
await db.insert(usersTable).values({
  organizationId: org.id,
  email: adminEmail,
  passwordHash,
  firstName: "Demo",
  lastName: "Admin",
  fullName: "Demo Admin",
  position: "HR Administrator",
  role: "hr_admin",
});

// --- Synthetic employees (all fictional) ----------------------------------
const employees = [
  { fullName: "Avery Brooks",   position: "Engineering Manager",    department: "Engineering", location: "Remote (US)",       workEmail: "avery.brooks@example.com",   startDate: "2021-03-15" },
  { fullName: "Jordan Patel",   position: "Senior Developer",       department: "Engineering", location: "Austin, TX",        workEmail: "jordan.patel@example.com",   startDate: "2022-07-01", managerName: "Avery Brooks" },
  { fullName: "Riley Nguyen",   position: "Product Designer",       department: "Design",      location: "Portland, OR",      workEmail: "riley.nguyen@example.com",   startDate: "2023-01-09" },
  { fullName: "Morgan Davis",   position: "HR Generalist",          department: "People",      location: "Chicago, IL",       workEmail: "morgan.davis@example.com",   startDate: "2020-11-02" },
  { fullName: "Casey Thompson", position: "Account Executive",      department: "Sales",       location: "Remote (US)",       workEmail: "casey.thompson@example.com", startDate: "2024-02-19" },
  { fullName: "Sam Rivera",     position: "Customer Success Lead",  department: "Support",     location: "Denver, CO",        workEmail: "sam.rivera@example.com",     startDate: "2019-08-26" },
];

await db.insert(employeesTable).values(
  employees.map((e) => ({
    organizationId: org.id,
    fullName: e.fullName,
    position: e.position,
    department: e.department,
    location: e.location,
    workEmail: e.workEmail,
    startDate: e.startDate,
    managerName: e.managerName,
    dataSource: "manual" as const,
  })),
);

console.log("✓ Seeded synthetic Guildlight demo data:");
console.log(`  Organization: Guildlight Demo Co (${DEMO_SLUG})`);
console.log(`  HR admin:     ${adminEmail} / ${adminPassword}`);
console.log(`  Employees:    ${employees.length} synthetic records`);
console.log("  Change the admin password after first login.");
process.exit(0);
