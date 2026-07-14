import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import {
  buildRepairContext,
  sendRepairEventNotification,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import type { RepairStatus } from "../../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const ALL_STATUSES: RepairStatus[] = [
  "turno_a_asignar",
  "turno_asignado",
  "pendientes_repuestos",
  "chapa",
  "pintura",
  "calidad",
  "experiencia_cliente",
  "pendientes_cobro",
  "archivado",
];

/**
 * PATCH /api/repairs/[id]/status
 * Mueve la reparación a una nueva columna del kanban y aplica side-effects:
 *  - chapa                → setea enteredAt si era null + dispara vehicle_entered
 *  - pendientes_repuestos → setea partsReceivedAt si era null
 *  - archivado            → setea archivedAt si era null
 *  - experiencia_cliente  → crea ServiceRating + dispara email
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

  // Notificaciones automáticas spec sección 6 — disparan según la columna
  // a la que se movió. Solo si hubo cambio efectivo de status.
  if (existing.status !== status) {
    const eventByStatus: Partial<
      Record<
        RepairStatus,
        | "vehicle_entered"
        | "parts_received"
        | "repair_completed"
        | "customer_experience"
      >
    > = {
      // Drag&drop directo a "chapa" sin pasar por el form: equivale a "el
      // vehículo entró al taller", así que dispara la misma notificación.
      chapa: "vehicle_entered",
      pendientes_repuestos: "parts_received",
      calidad: "repair_completed", // listo para retirar (pasó QC)
      experiencia_cliente: "customer_experience",
    };

    const event = eventByStatus[status];
    if (event) {
      buildRepairContext(updated.id)
        .then((ctx) => {
          if (ctx) return sendRepairEventNotification(event, ctx);
        })
        .catch((e) => console.error(`[notif:${event}] error en envío:`, e));
    }
  }

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
