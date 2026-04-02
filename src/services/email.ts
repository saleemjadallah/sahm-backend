import { Resend } from "resend";
import type { Order, Portrait, User } from "@prisma/client";
import { env } from "@/config/env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

function wrapEmail(title: string, body: string) {
  return `
    <div style="background:#f9f5f0;padding:32px;font-family:Inter,Arial,sans-serif;color:#3d3d3d">
      <div style="max-width:640px;margin:0 auto;background:#fffdf9;border-radius:24px;padding:32px;border:1px solid #efe7dc">
        <div style="font-family:Georgia,serif;font-size:30px;line-height:1.2;margin-bottom:16px">${title}</div>
        <div style="font-size:16px;line-height:1.7">${body}</div>
      </div>
    </div>
  `;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend || !to) {
    return;
  }

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject,
    html,
  });
}

export async function sendOrderConfirmationEmail(user: User, order: Order) {
  await sendEmail(
    user.email,
    `Your memorial portraits for ${order.petName} are being created`,
    wrapEmail(
      `We are creating ${order.petName}'s portraits`,
      `<p>Thank you for trusting Sahm with this memorial.</p>
       <p>Your order is confirmed and the artwork usually takes 2-5 minutes.</p>
       <p><a href="${env.FRONTEND_URL}/order/${order.id}/processing" style="color:#7c9885">View progress</a></p>`,
    ),
  );
}

export async function sendPortraitsReadyEmail(user: User, order: Order, portraits: Portrait[]) {
  const firstTwo = portraits.slice(0, 2);
  const thumbs = firstTwo
    .map(
      (portrait) =>
        `<img src="${portrait.previewUrl}" alt="${portrait.style}" style="width:140px;height:140px;object-fit:cover;border-radius:18px;margin-right:12px" />`,
    )
    .join("");

  await sendEmail(
    user.email,
    `${order.petName}'s memorial portraits are ready`,
    wrapEmail(
      `${order.petName}'s portraits are ready`,
      `<p>Your gallery is ready to view and download.</p>
       <div style="margin:20px 0">${thumbs}</div>
       <p><a href="${env.FRONTEND_URL}/order/${order.id}" style="color:#7c9885">View and download portraits</a></p>`,
    ),
  );
}

export async function sendGiftNotificationEmail(
  order: Order,
  senderName: string,
  portraits: Portrait[],
) {
  if (!order.recipientEmail) {
    return;
  }

  const preview = portraits[0]?.previewUrl
    ? `<img src="${portraits[0].previewUrl}" alt="${order.petName}" style="width:180px;height:180px;object-fit:cover;border-radius:18px" />`
    : "";

  await sendEmail(
    order.recipientEmail,
    `${senderName} sent you a special gift`,
    wrapEmail(
      `A memorial gift for ${order.petName}`,
      `<p>${senderName} created a memorial portrait collection for ${order.petName} and asked Sahm to deliver it to you gently.</p>
       ${order.personalMessage ? `<blockquote style="border-left:3px solid #d4a0a0;padding-left:14px;color:#5e5650">${order.personalMessage}</blockquote>` : ""}
       <div style="margin:20px 0">${preview}</div>
       <p>You can view, download, and print the portraits from the private gallery below.</p>
       <p><a href="${env.FRONTEND_URL}/gift/${order.giftToken}" style="color:#7c9885">View the memorial gallery</a></p>`,
    ),
  );
}

export async function sendGiftSentConfirmationEmail(user: User, order: Order) {
  if (!order.recipientEmail) {
    return;
  }

  await sendEmail(
    user.email,
    `Your gift for ${order.petName} has been delivered`,
    wrapEmail(
      `Your gift has been delivered`,
      `<p>We sent ${order.petName}'s memorial portraits to ${order.recipientEmail}.</p>
       <p><a href="${env.FRONTEND_URL}/order/${order.id}" style="color:#7c9885">View the portraits</a></p>`,
    ),
  );
}
