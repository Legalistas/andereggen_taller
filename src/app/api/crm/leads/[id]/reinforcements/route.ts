import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import type { RepairEventType } from "@/lib/email/templates/repair-event";
import {
  buildLeadContext,
  sendRepairEventNotification,
} from "@/lib/notifications";

type RouteContext = { params: Promise<{ id: string }> };

const REINFORCEMENTS: Record<string, RepairEventType> = {
  "1": "lead_reinforcement",
  "2": "lead_reinforcement_2",
  "3": "lead_reinforcement_3",
};

/**
 * POST /api/crm/leads/[id]/reinforcements  { n: 1 | 2 | 3 }
 *
 * C4 · Envío manual de un refuerzo desde la oportunidad. Cada envío queda en
 * NotificationLog, que es el registro que se ve en la ficha ("Refuerzo 2
 * enviado"), así el equipo deja de anotarlo a mano.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const event = REINFORCEMENTS[String(body?.n)];
  if (!event) {
    return NextResponse.json(
      { error: "Elegí Refuerzo 1, 2 o 3." },
      { status: 400 },
    );
  }

  const leadCtx = await buildLeadContext(id);
  if (!leadCtx) {
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  }

  const result = await sendRepairEventNotification(event, leadCtx);
  if (!result.enabled) {
    return NextResponse.json(
      {
        error:
          "El refuerzo automático está desactivado en Configuración → Notificaciones.",
      },
      { status: 409 },
    );
  }
  const delivered = result.sent.find((s) => s.ok);
  if (!delivered) {
    return NextResponse.json(
      { error: result.sent[0]?.error ?? "El cliente no tiene mail cargado." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, recipient: delivered.recipient });
}
