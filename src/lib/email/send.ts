/**
 * Helper único para enviar mails. Recibe un componente React de @react-email,
 * lo renderiza a HTML + text plano, y lo despacha por el transporter SMTP.
 *
 * Uso:
 *   import { sendEmail } from "@/lib/email/send";
 *   import { SampleEmail } from "@/lib/email/templates/sample";
 *
 *   await sendEmail({
 *     to: "cliente@correo.com",
 *     subject: "Tu presupuesto Andereggen",
 *     react: <SampleEmail name="Pablo" />,
 *   });
 */

import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { getFromAddress, getMailer } from "./client";

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  /** Reemplaza el "De" por esta dirección (default: SMTP_FROM / SMTP_USER). */
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
};

export type SendEmailResult = {
  messageId: string;
  accepted: string[];
  rejected: string[];
};

export async function sendEmail(
  opts: SendEmailOptions,
): Promise<SendEmailResult> {
  const mailer = getMailer();
  const html = await render(opts.react);
  const text = await render(opts.react, { plainText: true });

  const info = await mailer.sendMail({
    from: opts.from ?? getFromAddress(),
    to: opts.to,
    cc: opts.cc,
    bcc: opts.bcc,
    replyTo: opts.replyTo,
    subject: opts.subject,
    html,
    text,
    attachments: opts.attachments,
  });

  const toAddr = (v: unknown): string =>
    typeof v === "string"
      ? v
      : ((v as { address?: string })?.address ?? String(v));

  return {
    messageId: info.messageId,
    accepted: (info.accepted ?? []).map(toAddr),
    rejected: (info.rejected ?? []).map(toAddr),
  };
}

/** Verifica la conexión SMTP (útil para un endpoint de healthcheck). */
export async function verifySmtp(): Promise<boolean> {
  return getMailer().verify();
}
