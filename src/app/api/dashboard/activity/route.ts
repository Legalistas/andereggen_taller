/**
 * GET /api/dashboard/activity
 *
 * Últimas Repairs actualizadas — alimenta la tabla de "Actividad reciente"
 * del dashboard. Devuelve hasta 8 reparaciones ordenadas por updatedAt desc,
 * con info resumida del vehículo, mecánico, status y tiempo desde el cambio.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { RepairStatus } from "../../../../../generated/prisma/client";

const STATUS_GROUP: Record<RepairStatus, "completed" | "in-progress" | "pending"> = {
  turno_asignado: "pending",
  ingresado: "pending",
  pendientes_repuestos: "pending",
  chapa: "in-progress",
  pintura: "in-progress",
  calidad: "in-progress",
  pendientes_cobro: "completed",
  experiencia_cliente: "completed",
  archivado: "completed",
};

const STATUS_LABEL: Record<RepairStatus, string> = {
  turno_asignado: "Turno asignado",
  ingresado: "Ingresado",
  pendientes_repuestos: "Pend. repuestos",
  chapa: "Chapa",
  pintura: "Pintura",
  calidad: "Calidad",
  pendientes_cobro: "Pend. cobro",
  experiencia_cliente: "Experiencia cliente",
  archivado: "Archivado",
};

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 60) return `Hace ${Math.max(1, min)} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `Hace ${hr} ${hr === 1 ? "hora" : "horas"}`;
  const days = Math.round(hr / 24);
  if (days < 7) return `Hace ${days} ${days === 1 ? "día" : "días"}`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const repairs = await prisma.repair.findMany({
    take: 8,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      vehicleBrand: true,
      vehicleModel: true,
      vehicleYear: true,
      vehicleDomain: true,
      reason: true,
      assignedMechanic: { select: { name: true } },
    },
  });

  const items = repairs.map((r) => {
    const vehicle = [r.vehicleBrand, r.vehicleModel, r.vehicleYear]
      .filter((v) => v && v !== "S/D")
      .join(" ")
      .trim();
    return {
      id: r.id,
      vehicle: vehicle || "Vehículo S/D",
      plate: r.vehicleDomain && r.vehicleDomain !== "S/D" ? r.vehicleDomain : "—",
      service: r.reason ?? STATUS_LABEL[r.status],
      mechanic: r.assignedMechanic?.name ?? "Sin asignar",
      status: STATUS_GROUP[r.status],
      statusLabel: STATUS_LABEL[r.status],
      time: relativeTime(r.updatedAt),
    };
  });

  return NextResponse.json({ items });
}
