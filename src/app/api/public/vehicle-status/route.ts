/**
 * GET /api/public/vehicle-status?domain={patente}
 *
 * Endpoint **público** (sin auth) para que la web del taller pueda mostrar
 * el estado de una reparación. Solo devuelve datos NO sensibles:
 *   - Marca y modelo del vehículo (sin patente repetida ni datos del dueño)
 *   - Etapa actual del Kanban con label amigable
 *   - Fechas clave (turno, ingreso, entrega estimada, entrega real)
 *   - Última actualización
 *
 * NO devuelve: nombre/teléfono/email/dni del cliente, montos, repuestos,
 * presupuesto, mecánico asignado, etc.
 *
 * CORS abierto a cualquier origen (Access-Control-Allow-Origin: *) porque
 * lo consume la web pública desde otro dominio.
 *
 * Si hay varias reparaciones para la misma patente, devuelve la más
 * recientemente actualizada (la "actual" o la última archivada).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { RepairStatus } from "../../../../../generated/prisma/client";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

/**
 * Etapas en orden, con label público y mensaje amigable para el cliente.
 * stage = posición 1-8 para mostrar como "Etapa 4 de 8" o como progress bar.
 */
const STAGE_INFO: Record<
  RepairStatus,
  { stage: number; label: string; message: string }
> = {
  turno_a_asignar: {
    stage: 1,
    label: "Turno por coordinar",
    message:
      "Recibimos la aprobación de tu trabajo. En las próximas horas te contactamos para coordinar el turno.",
  },
  turno_asignado: {
    stage: 1,
    label: "Turno reservado",
    message: "Te asignamos el turno. Cuando ingrese el vehículo al taller te avisamos.",
  },
  ingresado: {
    stage: 2,
    label: "Ingresado al taller",
    message: "Recibimos tu vehículo en el taller.",
  },
  pendientes_repuestos: {
    stage: 2,
    label: "Esperando repuestos",
    message: "Estamos esperando que lleguen los repuestos pedidos para empezar el trabajo.",
  },
  chapa: {
    stage: 3,
    label: "En chapa",
    message: "Estamos trabajando en la chapa de tu vehículo.",
  },
  pintura: {
    stage: 4,
    label: "En pintura",
    message: "Estamos pintando tu vehículo.",
  },
  calidad: {
    stage: 5,
    label: "Control de calidad",
    message: "Estamos haciendo el control final de calidad.",
  },
  pendientes_cobro: {
    stage: 6,
    label: "Listo para retirar",
    message: "Tu vehículo está listo. Coordiná el pago y retiro con el taller.",
  },
  experiencia_cliente: {
    stage: 7,
    label: "Entregado",
    message: "¡Tu vehículo fue entregado! Si tenés un momento, contanos cómo fue tu experiencia.",
  },
  archivado: {
    stage: 8,
    label: "Reparación finalizada",
    message: "La reparación está finalizada y archivada.",
  },
};

const TOTAL_STAGES = 8;

/** Normaliza la patente (sin espacios, mayúsculas) para hacer match flexible. */
function normalizeDomain(d: string): string {
  return d.replace(/[\s-]/g, "").toUpperCase();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawDomain = url.searchParams.get("domain")?.trim() ?? "";

  if (!rawDomain) {
    return NextResponse.json(
      {
        found: false,
        error: "Falta el parámetro `domain` (patente del vehículo).",
      },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const target = normalizeDomain(rawDomain);

  // Buscamos repairs cuya patente normalizada coincida. Como no podemos hacer
  // la normalización en Postgres sin una columna calculada, traemos un set
  // acotado por LIKE relajado (sin espacios) y filtramos en memoria. Si no
  // hay resultados con patrón exacto, intentamos con variantes con espacios.
  const candidates = await prisma.repair.findMany({
    where: {
      OR: [
        { vehicleDomain: { equals: rawDomain, mode: "insensitive" } },
        { vehicleDomain: { contains: target.slice(0, 2), mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      status: true,
      vehicleBrand: true,
      vehicleModel: true,
      vehicleYear: true,
      vehicleDomain: true,
      scheduledAt: true,
      enteredAt: true,
      estimatedDeliveryAt: true,
      deliveredAt: true,
      archivedAt: true,
      updatedAt: true,
      createdAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const matches = candidates.filter(
    (r) => normalizeDomain(r.vehicleDomain) === target,
  );

  if (matches.length === 0) {
    return NextResponse.json(
      {
        found: false,
        message:
          "No encontramos ninguna reparación con esa patente. Verificá los datos o consultá con el taller.",
      },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  // matches viene ordenado por updatedAt desc → el primero es el más reciente.
  const r = matches[0];
  const info = STAGE_INFO[r.status];

  return NextResponse.json(
    {
      found: true,
      vehicle: {
        brand: r.vehicleBrand,
        model: r.vehicleModel,
        year: r.vehicleYear !== "S/D" ? r.vehicleYear : null,
        domain: r.vehicleDomain,
      },
      status: {
        key: r.status,
        label: info.label,
        message: info.message,
        stage: info.stage,
        totalStages: TOTAL_STAGES,
        progressPercent: Math.round((info.stage / TOTAL_STAGES) * 100),
        isFinished:
          r.status === "experiencia_cliente" || r.status === "archivado",
      },
      dates: {
        scheduledAt: r.scheduledAt,
        enteredAt: r.enteredAt,
        estimatedDeliveryAt: r.estimatedDeliveryAt,
        deliveredAt: r.deliveredAt,
      },
      lastUpdate: r.updatedAt,
    },
    { headers: CORS_HEADERS },
  );
}

/** Preflight CORS para navegadores que hacen OPTIONS antes del GET. */
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
