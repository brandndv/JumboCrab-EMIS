import "server-only";

import nodemailer from "nodemailer";

type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim();

  if (!host || !port || !from) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth:
      user && pass
        ? {
            user,
            pass,
          }
        : undefined,
    from,
  };
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const config = getSmtpConfig();
  if (!config) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  return cachedTransporter;
}

export function isEmailConfigured() {
  return Boolean(getSmtpConfig());
}

export function getEmailOverrideRecipient() {
  const override = process.env.SMTP_TO_OVERRIDE?.trim();
  return override ? override : null;
}

export function getAppBaseUrl() {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

export async function sendEmail(input: OutboundEmail) {
  const transporter = getTransporter();
  const config = getSmtpConfig();
  const overrideRecipient = getEmailOverrideRecipient();

  if (!transporter || !config) {
    throw new Error("SMTP is not configured.");
  }

  const finalRecipient = overrideRecipient || input.to;
  const originalRecipientNote =
    overrideRecipient && overrideRecipient !== input.to
      ? `\n\nOriginal intended recipient: ${input.to}`
      : "";

  await transporter.sendMail({
    from: config.from,
    to: finalRecipient,
    subject: overrideRecipient
      ? `[OVERRIDE for ${input.to}] ${input.subject}`
      : input.subject,
    text: `${input.text}${originalRecipientNote}`,
    html: `${input.html}${
      originalRecipientNote
        ? `<p style="margin-top:16px;color:#64748b;font-size:12px">Original intended recipient: ${input.to}</p>`
        : ""
    }`,
  });
}

export function buildAccountCreatedEmail(input: {
  username: string;
  tempPassword: string;
  roleLabel: string;
  signInUrl: string;
}) {
  const subject = "Your JumboCrab EMIS account is ready";
  const text = [
    "Your JumboCrab EMIS account has been created.",
    "",
    `Username: ${input.username}`,
    `Temporary password: ${input.tempPassword}`,
    `Role: ${input.roleLabel}`,
    "",
    `Sign in: ${input.signInUrl}`,
    "",
    "You will be required to change your password on first sign in.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin-bottom:12px">Your JumboCrab EMIS account is ready</h2>
      <p>Your account has been created.</p>
      <p><strong>Username:</strong> ${input.username}<br />
      <strong>Temporary password:</strong> ${input.tempPassword}<br />
      <strong>Role:</strong> ${input.roleLabel}</p>
      <p><a href="${input.signInUrl}">Sign in to JumboCrab EMIS</a></p>
      <p>You will be required to change your password on first sign in.</p>
    </div>
  `;

  return { subject, text, html };
}

export function buildNotificationEmail(input: {
  title: string;
  message: string;
  actionUrl: string;
}) {
  const subject = input.title;
  const text = `${input.message}\n\nOpen: ${input.actionUrl}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin-bottom:12px">${input.title}</h2>
      <p>${input.message}</p>
      <p><a href="${input.actionUrl}">Open in JumboCrab EMIS</a></p>
    </div>
  `;

  return { subject, text, html };
}
