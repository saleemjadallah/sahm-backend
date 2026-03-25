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
 * Send a credit purchase confirmation email.
 */
export async function sendCreditPurchaseConfirmation(
  email: string,
  credits: number,
): Promise<void> {
  await sendEmail({
    to: email,
    subject: `${credits} credits added to your Sahm account ✦`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #1a1a3e; text-align: center;">سهم Sahm</h1>
        <h2 style="color: #333; text-align: center;">${credits} Credits Added!</h2>
        <p style="color: #666; text-align: center; font-size: 16px;">
          Your credits are ready to use. Start creating beautiful designs across all categories.
        </p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${env.FRONTEND_URL}/create" style="background: #d4a853; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px;">
            Start Creating
          </a>
        </div>
      </div>
    `,
  });
}
