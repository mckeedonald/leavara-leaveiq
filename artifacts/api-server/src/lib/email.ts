import { logger } from "./logger";

const RESEND_API_KEY = process.env["RESEND_API_KEY"];
const FROM_EMAIL = process.env["RESEND_FROM_EMAIL"] ?? "noreply@leavara.net";

function getAppUrl(): string {
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  if (domain) return `https://${domain}`;
  return process.env["APP_URL"] ?? "http://localhost:3000";
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    logger.warn({ to, subject }, "RESEND_API_KEY not set — email not sent");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ to, subject, status: res.status, body }, "Failed to send email via Resend");
    throw new Error(`Resend error ${res.status}: ${body}`);
  }

  logger.info({ to, subject }, "Email sent successfully");
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
}): Promise<void> {
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

  await sendEmail(
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
