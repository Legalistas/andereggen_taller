import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import type { RepairEventType } from "@/lib/email/templates/repair-event";
import { notifyRepairEvent } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import type { RepairStatus } from "../../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const ALL_STATUSES: RepairStatus[] = [
  "turno_a_asignar",
  "turno_asignado",
  "pendientes_repuestos",
  "chapa",
  "pintura",
  "pulido_armado",
  "calidad",
  "experiencia_cliente",
  "pendientes_cobro",
  "archivado",
];

const EVENT_BY_STATUS: Partial<Record<RepairStatus, RepairEventType>> = {
  pendientes_repuestos: "parts_pending", // P2
  // Drag&drop directo a "chapa" sin pasar por el form: equivale a "el
  // vehículo entró al taller", así que dispara la misma notificación.
  chapa: "vehicle_entered", // P3
  pintura: "paint_started", // P4
  pulido_armado: "polish_started", // P5
  calidad: "quality_check", // P6 · todavía NO está listo para retirar
  experiencia_cliente: "customer_experience", // pase manual (sección 6)
};

/**
 * PATCH /api/repairs/[id]/status
 * Mueve la reparación a una nueva columna del kanban y aplica side-effects:
 *  - chapa                → setea enteredAt si era null
 *  - pendientes_repuestos → setea partsReceivedAt si era null
 *  - archivado            → setea archivedAt si era null
 *  - experiencia_cliente  → crea ServiceRating
 *  y manda el aviso de la etapa (EVENT_BY_STATUS).
 *
 * NOTA: La columna "Ingresado" fue removida del flujo. Cuando el vehículo
 * llega al taller, se setea la fecha de ingreso desde el form de la card y
 * el status pasa directo a "chapa" (lo maneja PATCH /api/repairs/[id]).
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const status = body?.status as RepairStatus | undefined;
  if (!status || !ALL_STATUSES.includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const existing = await prisma.repair.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Reparación no encontrada" },
      { status: 404 },
    );
  }

  const now = new Date();
  const data: Record<string, unknown> = { status };

  // Si arrastran directo a "chapa" sin haber pasado por el form de ingreso,
  // seteamos enteredAt automáticamente (mismo efecto que cargarlo a mano).
  if (status === "chapa" && !existing.enteredAt) {
    data.enteredAt = now;
  }
  if (status === "pendientes_repuestos" && !existing.partsReceivedAt) {
    data.partsReceivedAt = now;
  }
  if (status === "archivado" && !existing.archivedAt) {
    data.archivedAt = now;
  }
  // Si vuelven de archivado a cualquier columna activa, limpiamos archivedAt
  if (status !== "archivado" && existing.archivedAt) {
    data.archivedAt = null;
  }

  const updated = await prisma.repair.update({
    where: { id },
    data,
    include: {
      assignedMechanic: {
        select: { id: true, name: true, email: true, image: true },
      },
      budget: { select: { id: true, number: true, grandTotal: true } },
    },
  });

  // E2.B — Si pasa a "experiencia_cliente" y todavía no existe el rating,
  // creamos el ServiceRating con un token único antes de disparar el email.
  // Así `buildRepairContext` puede armar la surveyUrl correcta.
  if (
    status === "experiencia_cliente" &&
    existing.status !== "experiencia_cliente"
  ) {
    const dupe = await prisma.serviceRating.findUnique({
      where: { repairId: id },
    });
    if (!dupe) {
      await prisma.serviceRating.create({
        data: {
          repairId: id,
          token: generateToken(),
        },
      });
    }
  }

  // Avisos al cliente por etapa (automatizaciones v1.3 · sección 5). Solo si
  // hubo cambio efectivo de status. Archivado no avisa: es el camino manual
  // para los casos con conflicto (sección 6).
  const event = EVENT_BY_STATUS[status];
  if (event && existing.status !== status) notifyRepairEvent(event, id);

  return NextResponse.json({ repair: updated });
}

/**
 * Token opaco para la URL pública /reviews/[token].
 * Usa crypto.randomUUID si está disponible (Node 20+), fallback a random.
 */
function generateToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
