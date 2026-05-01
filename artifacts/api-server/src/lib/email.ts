import { logger } from "./logger";

const RESEND_API_KEY = process.env["RESEND_API_KEY"];
const FROM_EMAIL = process.env["RESEND_FROM_EMAIL"] ?? "noreply@leavara.net";

export interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded file content
}

export function getAppUrl(): string {
  // Explicit override takes highest priority
  if (process.env["APP_URL"]) return process.env["APP_URL"];
  // Railway auto-injects RAILWAY_PUBLIC_DOMAIN for the service's public URL
  if (process.env["RAILWAY_PUBLIC_DOMAIN"]) return `https://${process.env["RAILWAY_PUBLIC_DOMAIN"]}`;
  // Replit fallback
  const replitDomain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  if (replitDomain) return `https://${replitDomain}`;
  return "http://localhost:3000";
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: EmailAttachment[],
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    logger.warn({ to, subject }, "RESEND_API_KEY not set — email not sent");
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ to, subject, status: res.status, body }, "Failed to send email via Resend");
    throw new Error(`Resend error ${res.status}: ${body}`);
  }

  logger.info({ to, subject }, "Email sent successfully");
  return true;
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${getAppUrl()}/reset-password?token=${token}`;
  await sendEmail(
    to,
    "LeaveIQ — Reset Your Password",
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#3D2010">Reset Your Password</h2>
      <p>You requested a password reset for your Leavara LeaveIQ account. Click the button below to set a new password. This link expires in 1 hour.</p>
      <a href="${link}" style="display:inline-block;background:#C97E59;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Reset Password</a>
      <p style="color:#8C7058;font-size:14px">If you did not request this, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid #D4C9BB;margin:24px 0"/>
      <p style="color:#A47864;font-size:12px">Leavara LeaveIQ &mdash; HR Decision Support</p>
    </div>
    `,
  );
}

export async function sendInviteEmail(
  to: string,
  token: string,
  role: "admin" | "user",
  sentByName: string,
): Promise<void> {
  const link = `${getAppUrl()}/register?token=${token}`;
  await sendEmail(
    to,
    "You've been invited to Leavara LeaveIQ",
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#3D2010">Welcome to Leavara LeaveIQ</h2>
      <p>${sentByName} has invited you to join Leavara LeaveIQ as an <strong>${role === "admin" ? "Administrator" : "HR User"}</strong>.</p>
      <p>Click the button below to complete your enrollment. This invitation expires in 7 days.</p>
      <a href="${link}" style="display:inline-block;background:#C97E59;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Accept Invitation</a>
      <p style="color:#8C7058;font-size:14px">If you were not expecting this invitation, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid #D4C9BB;margin:24px 0"/>
      <p style="color:#A47864;font-size:12px">Leavara LeaveIQ &mdash; HR Decision Support</p>
    </div>
    `,
  );
}

export async function sendNoticeEmail(data: {
  to: string;
  noticeType: string;
  content: string;
  caseNumber: string;
  employeeNumber: string;
  attachments?: EmailAttachment[];
}): Promise<boolean> {
  const noticeTitles: Record<string, string> = {
    ELIGIBILITY_NOTICE: "Notice of Eligibility & Rights",
    DESIGNATION_NOTICE: "FMLA/CFRA Designation Notice",
    DESIGNATION_NOTICE_APPROVAL: "Designation Notice — Leave Approved",
    DESIGNATION_NOTICE_DENIAL: "Designation Notice — Leave Denied",
    CERTIFICATION_REQUEST: "Request for Medical Certification",
    APPROVAL_LETTER: "Leave Approval Letter",
    DENIAL_LETTER: "Leave Denial Letter",
    MORE_INFO_REQUEST: "Request for Additional Information",
    INFO_REQUEST_LETTER: "Additional Information Required",
  };

  const title = noticeTitles[data.noticeType] ?? data.noticeType.replace(/_/g, " ");
  const subject = `LeaveIQ — ${title} (Case ${data.caseNumber})`;

  const formattedContent = data.content
    .split("\n")
    .map((line) => `<p style="margin:0 0 12px;line-height:1.6">${line.length > 0 ? line : "&nbsp;"}</p>`)
    .join("");

  return sendEmail(
    data.to,
    subject,
    `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#C97E59;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">${title}</h2>
        <p style="color:#f0eee9;margin:4px 0 0;font-size:13px">Case Number: ${data.caseNumber} &bull; Employee: ${data.employeeNumber}</p>
      </div>
      <div style="border:1px solid #D4C9BB;border-top:none;border-radius:0 0 8px 8px;padding:24px;color:#3D2010">
        ${formattedContent}
      </div>
      <p style="color:#A47864;font-size:12px;margin-top:16px;text-align:center">
        This notice was generated and approved by your HR team via Leavara LeaveIQ.
        <br/>If you have questions, please contact your HR department directly.
      </p>
    </div>
    `,
    data.attachments,
  );
}

export async function sendWelcomeEmail(data: {
  to: string;
  firstName: string;
  lastName: string;
  orgName: string;
  password: string;
}): Promise<void> {
  const loginUrl = getAppUrl();
  await sendEmail(
    data.to,
    "Welcome to Leavara LeaveIQ — Your Account Details",
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#C97E59;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0">Welcome to Leavara LeaveIQ</h2>
        <p style="color:#f0eee9;margin:4px 0 0;font-size:14px">${data.orgName}</p>
      </div>
      <div style="border:1px solid #D4C9BB;border-top:none;border-radius:0 0 8px 8px;padding:24px;color:#3D2010">
        <p>Hi ${data.firstName} ${data.lastName},</p>
        <p>Your LeaveIQ account has been created. You can sign in immediately using the credentials below.</p>
        <div style="background:#F7F4F0;border:1px solid #D4C9BB;border-radius:8px;padding:16px;margin:16px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap;width:30%">Email</td>
              <td style="padding:6px 0;color:#3D2010;font-family:monospace">${data.to}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap">Password</td>
              <td style="padding:6px 0;color:#3D2010;font-family:monospace">${data.password}</td>
            </tr>
          </table>
        </div>
        <p style="color:#8C7058;font-size:13px">We recommend changing your password after your first login via Account Settings.</p>
        <a href="${loginUrl}/login" style="display:inline-block;background:#C97E59;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Sign In to LeaveIQ</a>
      </div>
      <hr style="border:none;border-top:1px solid #D4C9BB;margin:24px 0"/>
      <p style="color:#A47864;font-size:12px">Leavara LeaveIQ &mdash; HR Decision Support &bull; ${data.orgName}</p>
    </div>
    `,
  );
}

export async function sendMagicLinkEmail(
  to: string,
  caseNumber: string,
  magicLinkUrl: string,
): Promise<void> {
  await sendEmail(
    to,
    `✅ Leave Request Received — Case ${caseNumber}`,
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#C97E59;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0">Leave Request Received</h2>
        <p style="color:#f0eee9;margin:4px 0 0;font-size:14px">Case Number: <strong>${caseNumber}</strong></p>
      </div>
      <div style="border:1px solid #D4C9BB;border-top:none;border-radius:0 0 8px 8px;padding:24px;color:#3D2010">
        <p>Your leave of absence request has been received and is now under review by your HR team. You can expect to hear back within <strong>2–3 business days</strong>.</p>
        <div style="background:#F7F4F0;border:1px solid #D4C9BB;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
          <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#8C7058;text-transform:uppercase;letter-spacing:0.05em">Your Case Number</p>
          <p style="margin:0;font-size:24px;font-weight:700;color:#9E5D38;font-family:monospace">${caseNumber}</p>
        </div>
        <p>Use the button below to:</p>
        <ul style="color:#5C3D28;margin:0 0 16px;padding-left:20px">
          <li style="margin-bottom:6px">Check your case status</li>
          <li style="margin-bottom:6px">Upload supporting documents (medical certifications, doctor's notes, etc.)</li>
          <li>View any notices sent by HR</li>
        </ul>
        <a href="${magicLinkUrl}" style="display:inline-block;background:#C97E59;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:8px 0;font-size:15px">View My Case Status →</a>
        <p style="color:#8C7058;font-size:13px;margin-top:16px">This link is private and unique to you — please do not share it. It expires in 30 days.</p>
        <p style="color:#8C7058;font-size:13px">If you have questions, contact your HR department directly.</p>
      </div>
      <hr style="border:none;border-top:1px solid #D4C9BB;margin:24px 0"/>
      <p style="color:#A47864;font-size:12px">Leavara LeaveIQ &mdash; HR Decision Support</p>
    </div>
    `,
  );
}

export async function sendDocumentUploadNotification(
  to: string,
  caseNumber: string,
  fileName: string,
  employeeName: string,
): Promise<void> {
  await sendEmail(
    to,
    `LeaveIQ — Document Uploaded for Case ${caseNumber}`,
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#C97E59;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0">New Document Uploaded</h2>
        <p style="color:#f0eee9;margin:4px 0 0;font-size:14px">Case Number: ${caseNumber}</p>
      </div>
      <div style="border:1px solid #D4C9BB;border-top:none;border-radius:0 0 8px 8px;padding:24px;color:#3D2010">
        <p><strong>${employeeName}</strong> has uploaded a new document to their leave case.</p>
        <div style="background:#F7F4F0;border:1px solid #D4C9BB;border-radius:8px;padding:16px;margin:16px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap;width:30%">Case</td>
              <td style="padding:6px 0;color:#3D2010">${caseNumber}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap">Employee</td>
              <td style="padding:6px 0;color:#3D2010">${employeeName}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap">File</td>
              <td style="padding:6px 0;color:#3D2010;font-family:monospace">${fileName}</td>
            </tr>
          </table>
        </div>
        <p>Please log in to LeaveIQ to review the uploaded documentation.</p>
        <a href="${getAppUrl()}/cases" style="display:inline-block;background:#C97E59;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:8px 0">View Cases in LeaveIQ</a>
      </div>
      <hr style="border:none;border-top:1px solid #D4C9BB;margin:24px 0"/>
      <p style="color:#A47864;font-size:12px">Leavara LeaveIQ &mdash; HR Decision Support</p>
    </div>
    `,
  );
}

export async function sendNewCaseNotificationEmail(params: {
  to: string;
  hrFirstName: string;
  caseNumber: string;
  employeeName: string;
  leaveReason: string;
  requestedStart: string;
  requestedEnd: string | null;
  caseUrl: string;
}): Promise<void> {
  await sendEmail(
    params.to,
    `New Leave Request — Case ${params.caseNumber}`,
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#C97E59;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0">New Leave Request</h2>
        <p style="color:#f0eee9;margin:4px 0 0;font-size:14px">Case Number: <strong>${params.caseNumber}</strong></p>
      </div>
      <div style="border:1px solid #D4C9BB;border-top:none;border-radius:0 0 8px 8px;padding:24px;color:#3D2010">
        <p>Hi ${params.hrFirstName},</p>
        <p>A new leave of absence request has been submitted and is awaiting your review.</p>
        <div style="background:#F7F4F0;border:1px solid #D4C9BB;border-radius:8px;padding:16px;margin:16px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap;width:35%">Case Number</td>
              <td style="padding:6px 0;color:#3D2010;font-family:monospace">${params.caseNumber}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap">Employee</td>
              <td style="padding:6px 0;color:#3D2010">${params.employeeName}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap">Leave Reason</td>
              <td style="padding:6px 0;color:#3D2010">${params.leaveReason}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap">Start Date</td>
              <td style="padding:6px 0;color:#3D2010">${params.requestedStart}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap">End Date</td>
              <td style="padding:6px 0;color:#3D2010">${params.requestedEnd ?? "Not specified"}</td>
            </tr>
          </table>
        </div>
        <a href="${params.caseUrl}" style="display:inline-block;background:#C97E59;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:8px 0">View Case in LeaveIQ</a>
      </div>
      <hr style="border:none;border-top:1px solid #D4C9BB;margin:24px 0"/>
      <p style="color:#A47864;font-size:12px">Leavara LeaveIQ &mdash; HR Decision Support</p>
    </div>
    `,
  );
}

export async function sendReturnToWorkNotification(params: {
  to: string;
  hrFirstName: string;
  employeeName: string;
  caseNumber: string;
  returnDate: string;
  caseUrl: string;
}): Promise<void> {
  await sendEmail(
    params.to,
    `Employee Return to Work — Case ${params.caseNumber}`,
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#C97E59;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0">Return to Work Reported</h2>
        <p style="color:#f0eee9;margin:4px 0 0;font-size:14px">Case Number: <strong>${params.caseNumber}</strong></p>
      </div>
      <div style="border:1px solid #D4C9BB;border-top:none;border-radius:0 0 8px 8px;padding:24px;color:#3D2010">
        <p>Hi ${params.hrFirstName},</p>
        <p><strong>${params.employeeName}</strong> has reported their return to work date via the employee portal.</p>
        <div style="background:#F7F4F0;border:1px solid #D4C9BB;border-radius:8px;padding:16px;margin:16px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap;width:35%">Case Number</td>
              <td style="padding:6px 0;color:#3D2010;font-family:monospace">${params.caseNumber}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap">Employee</td>
              <td style="padding:6px 0;color:#3D2010">${params.employeeName}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px 6px 0;font-weight:600;color:#5C3D28;white-space:nowrap">Return Date</td>
              <td style="padding:6px 0;color:#3D2010;font-weight:600">${params.returnDate}</td>
            </tr>
          </table>
        </div>
        <p style="color:#8C7058;font-size:13px">Please review the case and close it if appropriate.</p>
        <a href="${params.caseUrl}" style="display:inline-block;background:#C97E59;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:8px 0">View Case in LeaveIQ</a>
      </div>
      <hr style="border:none;border-top:1px solid #D4C9BB;margin:24px 0"/>
      <p style="color:#A47864;font-size:12px">Leavara LeaveIQ &mdash; HR Decision Support</p>
    </div>
    `,
  );
}

export async function sendInterestEmail(data: {
  companyName: string;
  contactName: string;
  title?: string;
  email: string;
  phone?: string;
  companySize: string;
  message?: string;
}): Promise<void> {
  const rows = [
    ["Company", data.companyName],
    ["Company Size", data.companySize],
    ["Contact Name", data.contactName],
    ...(data.title ? [["Title", data.title]] : []),
    ["Email", data.email],
    ...(data.phone ? [["Phone", data.phone]] : []),
    ...(data.message ? [["Message", data.message]] : []),
  ] as [string, string][];

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;font-weight:600;color:#5C3D28;background:#F7F4F0;white-space:nowrap">${label}</td><td style="padding:8px 12px;color:#3D2010">${value}</td></tr>`,
    )
    .join("");

  await sendEmail(
    "donnie@leavara.net",
    `LeaveIQ Interest: ${data.companyName}`,
    `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#C97E59;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0">New LeaveIQ Interest Submission</h2>
        <p style="color:#f0eee9;margin:4px 0 0;font-size:14px">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>
      <div style="border:1px solid #D4C9BB;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          ${tableRows}
        </table>
      </div>
      <p style="color:#A47864;font-size:12px;margin-top:16px">Sent from the Leavara LeaveIQ interest form at leavara.net</p>
    </div>
    `,
  );
}
