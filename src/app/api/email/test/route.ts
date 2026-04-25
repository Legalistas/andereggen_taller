import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { sendEmail, verifySmtp } from "@/lib/email/send";
import { SampleEmail } from "@/lib/email/templates/sample";

/**
 * GET  /api/email/test              → verifica conexión SMTP (auth requerida)
 * POST /api/email/test { to, name } → envía un mail de prueba (auth requerida)
 *
 * Solo admin/internal. Útil para validar credenciales SMTP y previsualizar
 * el layout base sin disparar flujos reales del CRM.
 */

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  try {
    const ok = await verifySmtp();
    return NextResponse.json({
      ok,
      provider: process.env.SMTP_PROVIDER ?? "gmail",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const to = typeof body.to === "string" ? body.to : null;
  const name = typeof body.name === "string" ? body.name : "Pablo";

  if (!to) {
    return NextResponse.json({ error: "Falta el campo `to`" }, { status: 400 });
  }

  try {
    const result = await sendEmail({
      to,
      subject: "Email de prueba — Andereggen Taller",
      react: SampleEmail({
        name,
        message:
          "Si estás leyendo esto, la configuración SMTP quedó correcta. Esta es la plantilla base que usaremos para las notificaciones del CRM.",
        actionUrl: process.env.AUTH_URL ?? "http://localhost:3000",
        actionLabel: "Abrir panel",
      }),
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/email/test failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al enviar" },
      { status: 500 },
    );
  }
}
