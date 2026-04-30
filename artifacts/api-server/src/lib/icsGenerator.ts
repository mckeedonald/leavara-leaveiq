/**
 * .ics (iCalendar) file generator for follow-up calendar invites.
 * Generates RFC 5545-compliant .ics content for email delivery.
 */

function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function generateUid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}@leavara.com`;
}

export interface IcsEventOptions {
  title: string;
  description?: string;
  startDate: Date;
  durationMinutes?: number;
  organizerEmail: string;
  organizerName?: string;
  attendeeEmails: string[];
  location?: string;
}

/**
 * Generate an RFC 5545 .ics file string for a calendar event.
 */
export function generateIcs(opts: IcsEventOptions): string {
  const { title, description, startDate, durationMinutes = 30, organizerEmail, organizerName, attendeeEmails, location } = opts;

  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();
  const uid = generateUid();

  const attendeeLines = attendeeEmails
    .map((email) => `ATTENDEE;RSVP=TRUE;ROLE=REQ-PARTICIPANT:mailto:${email}`)
    .join("\r\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Leavara//LeaveIQ//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(startDate)}`,
    `DTEND:${icsDate(endDate)}`,
    `SUMMARY:${escapeIcs(title)}`,
    description ? `DESCRIPTION:${escapeIcs(description)}` : null,
    location ? `LOCATION:${escapeIcs(location)}` : null,
    `ORGANIZER;CN=${escapeIcs(organizerName ?? organizerEmail)}:mailto:${organizerEmail}`,
    attendeeLines || null,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${escapeIcs(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean) as string[];

  return lines.join("\r\n");
}
