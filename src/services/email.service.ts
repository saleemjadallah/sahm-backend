import { Resend } from "resend";
import { env } from "../config/env.js";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    if (!env.RESEND_API_KEY) throw new Error("Resend is not configured");
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

/**
 * Send a transactional email via Resend.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const { to, subject, html, from, replyTo } = options;

  try {
    await getResend().emails.send({
      from: from || env.EMAIL_FROM,
      to,
      subject,
      html,
      replyTo,
    });
  } catch (err) {
    // Log but don't throw — email failure shouldn't break the flow
    console.error("Failed to send email:", {
      to,
      subject,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Send an RSVP notification email to the project owner.
 */
export async function sendRsvpNotification(
  ownerEmail: string,
  guestName: string,
  rsvpStatus: string,
  projectTitle: string,
): Promise<void> {
  const statusText =
    rsvpStatus === "ATTENDING"
      ? "will attend \u2705"
      : rsvpStatus === "NOT_ATTENDING"
        ? "cannot attend \u274c"
        : "might attend \u2753";

  await sendEmail({
    to: ownerEmail,
    subject: `RSVP Update: ${guestName} ${statusText} - ${projectTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #1a1a3e; text-align: center;">\u0633\u0647\u0645 Sahm</h1>
        <h2 style="color: #333; text-align: center;">RSVP Update</h2>
        <div style="background: #f9f9f9; border-radius: 12px; padding: 24px; margin: 20px 0;">
          <p style="font-size: 16px; color: #333;"><strong>${guestName}</strong> ${statusText}</p>
          <p style="font-size: 14px; color: #666;">Project: ${projectTitle}</p>
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${env.FRONTEND_URL}/projects" style="background: #d4a853; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            View Dashboard
          </a>
        </div>
      </div>
    `,
  });
}

/**
 * Send a milestone reminder email.
 */
export async function sendMilestoneReminder(
  email: string,
  babyName: string,
  milestoneLabel: string,
  projectId: string,
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `${babyName} - ${milestoneLabel}! Your milestone card is ready \u2728`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #1a1a3e; text-align: center;">\u0633\u0647\u0645 Sahm</h1>
        <h2 style="color: #333; text-align: center;">${babyName} - ${milestoneLabel}!</h2>
        <p style="color: #666; text-align: center; font-size: 16px;">
          Your milestone card is ready to share. \u2728
        </p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${env.FRONTEND_URL}/projects/${projectId}" style="background: #d4a853; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px;">
            View & Share
          </a>
        </div>
      </div>
    `,
  });
}
