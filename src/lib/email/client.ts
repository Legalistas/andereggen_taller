/**
 * Transporter SMTP singleton (nodemailer).
 * Config vía .env:
 *   SMTP_PROVIDER=gmail        → usa el service "gmail" de nodemailer
 *   SMTP_PROVIDER=generic      → usa SMTP_HOST/PORT/SECURE manuales
 *   SMTP_USER, SMTP_PASS       → credenciales (App Password en Gmail)
 *   SMTP_FROM                  → dirección visible en "De" (fallback: SMTP_USER)
 */

import nodemailer, { type Transporter } from "nodemailer";

type GlobalWithMailer = typeof globalThis & {
  __mailerTransport?: Transporter;
};

function build(): Transporter {
  const user = required("SMTP_USER");
  const pass = required("SMTP_PASS");
  const provider = (process.env.SMTP_PROVIDER ?? "gmail").toLowerCase();

  if (provider === "gmail") {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  if (provider === "generic") {
    const host = required("SMTP_HOST");
    const port = Number(process.env.SMTP_PORT ?? "587");
    const secure =
      (process.env.SMTP_SECURE ?? "").toLowerCase() === "true" || port === 465;
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  throw new Error(
    `SMTP_PROVIDER inválido: "${provider}". Usá "gmail" o "generic".`,
  );
}

export function getMailer(): Transporter {
  const g = globalThis as GlobalWithMailer;
  if (!g.__mailerTransport) {
    g.__mailerTransport = build();
  }
  return g.__mailerTransport;
}

export function getFromAddress(): string {
  return process.env.SMTP_FROM ?? required("SMTP_USER");
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Falta la variable de entorno ${key}.`);
  return v;
}
