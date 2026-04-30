import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * Scheduled follow-up calendar invites suggested by Ada.
 * HR selects a date; system generates an .ics file and sends via email.
 */
export const calendarInvitesTable = pgTable("calendar_invite", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),

  // Context — either a leave case or an ADA case
  caseType: text("case_type").notNull(),   // "leave" | "ada"
  caseId: uuid("case_id").notNull(),
  caseNumber: text("case_number"),

  title: text("title").notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  durationMinutes: text("duration_minutes").default("30"),

  attendeeEmails: text("attendee_emails").notNull(), // comma-separated
  organizerEmail: text("organizer_email").notNull(),

  icsGenerated: boolean("ics_generated").default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CalendarInvite = typeof calendarInvitesTable.$inferSelect;
export type InsertCalendarInvite = typeof calendarInvitesTable.$inferInsert;
