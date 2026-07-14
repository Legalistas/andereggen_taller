/**
 * GET /api/stats
 *
 * Estadísticas simplificadas — dos bloques bien separados:
 *
 * 1. Cotizaciones (CRM) — spec 1.1 + 3.1 v2
 *    - totalYear / totalMonth: Leads creados en el período (por Lead ID,
 *      NO por presupuesto — cada tarjeta cuenta una sola vez).
 *    - byStage: conteo de Leads por cada estado del embudo (snapshot actual)
 *    - conversionRate: ganados / (ganados + perdidos) del mes, imputando
 *      "ganados" al mes en que se recibió la orden (Lead.orderReceivedAt).
 *    - won / lost / closed (mensuales, para el denominador del rate)
 *
 * 2. Producción (Repair) — spec 2.2 v2
 *    - byStage: cuántos vehículos hay AHORA en cada columna del Kanban (excl. archivado)
 *    - totalActive: sólo Turno Asignado → Calidad (excluye Experiencia del
 *      Cliente y Pendientes de Cobro; ya no cuentan como "en taller").
 *    - completedThisMonth: cuántas reparaciones se cerraron (archivado) este mes
 *
 * 3. Por compañía (spec 3.1 v2)
 *    - Se agrupa por Seguro Responsable (Propio / Tercero → nombre de
 *      compañía; Particular → bucket separado).
 *
 * Sin filtros de período: el corte es siempre "mes actual" para los counters
 * mensuales y "año en curso" para los anuales.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type {
  LeadStatus,
  RepairStatus,
} from "../../../../generated/prisma/client";

const LEAD_STAGES: LeadStatus[] = [
  "solicitud",
  "control",
  "enviado",
  "refuerzo",
  "pendientes_cobro",
  "ganado",
  "perdido",
];

// Estados activos del Kanban de producción (sin archivado)
const REPAIR_STAGES: RepairStatus[] = [
  "turno_a_asignar",
  "turno_asignado",
  "pendientes_repuestos",
  "chapa",
  "pintura",
  "calidad",
  "pendientes_cobro",
  "experiencia_cliente",
];

// spec 2.2 v2 · "En taller" solo cuenta hasta Calidad. A partir de
// Experiencia del Cliente el vehículo deja de contarse como en taller.
const IN_SHOP_STAGES: RepairStatus[] = [
  "turno_asignado",
  "pendientes_repuestos",
  "chapa",
  "pintura",
  "calidad",
];

/**
 * Bucket por compañía de seguro. Las 3 principales se reconocen por
 * substring sobre el nombre de la compañía asociada al Lead
 * (Lead.insuranceCompany.name para propio, Vehicle.thirdPartySecure para
 * tercero). "PARTICULARES" agrupa los leads cuyo Seguro Responsable es
 * "particular". "OTROS" agrupa compañías fuera de las 3 principales.
 * "SIN_DEFINIR" son leads sin Seguro Responsable seteado (histórico).
 */
type InsuranceBucket =
  | "NORTE"
  | "SANCOR"
  | "SAN_CRIST"
  | "OTROS"
  | "PARTICULARES"
  | "SIN_DEFINIR";

function bucketByCompanyName(name: string | null): InsuranceBucket {
  if (!name || name.trim() === "") return "OTROS";
  const v = name.toLowerCase();
  if (v.includes("norte")) return "NORTE";
  if (v.includes("sancor")) return "SANCOR";
  if (v.includes("san crist") || v.includes("sancrist")) return "SAN_CRIST";
  return "OTROS";
}

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  // Mes de referencia para los counters mensuales. Formato YYYY-MM. Si no
  // viene, usa el mes actual. Permite que el frontend cambie entre meses
  // sin perder el resto del payload.
  const monthParam = url.searchParams.get("month");
  const now = new Date();
  let monthRef: Date;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    monthRef = new Date(y, m - 1, 1);
  } else {
    monthRef = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const startOfMonth = monthRef;
  const startOfNextMonth = new Date(
    monthRef.getFullYear(),
    monthRef.getMonth() + 1,
    1,
  );
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    leadsYear,
    leadsMonth,
    wonThisMonth,
    lostThisMonth,
    leadCounts,
    repairCounts,
    completedMonth,
    monthLeads,
    deliveredList,
    enteredList,
  ] = await Promise.all([
    // spec 1.1 v2 · Contamos por Lead ID (tarjeta), no por Budget.
    prisma.lead.count({ where: { createdAt: { gte: startOfYear } } }),
    prisma.lead.count({
      where: {
        createdAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    }),
    // spec 1.1 + 3.1 v2 · Ganados del mes imputados a orderReceivedAt.
    prisma.lead.count({
      where: {
        status: "ganado",
        orderReceivedAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    }),
    // Perdidos del mes imputados a updatedAt.
    prisma.lead.count({
      where: {
        status: "perdido",
        updatedAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.repair.groupBy({ by: ["status"], _count: true }),
    prisma.repair.count({
      where: {
        status: "archivado",
        archivedAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    }),
    // spec 3.1 v2 · Desglose por compañía basado en Seguro Responsable.
    // Traemos los Leads del mes con su compañía y el seguro del tercero para
    // poder rutear cada uno al bucket correcto. Filtramos por createdAt del
    // Lead (mismo criterio que "totalMonth") para que el denominador cierre.
    prisma.lead.findMany({
      where: {
        createdAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
      select: {
        status: true,
        insuranceResponsibility: true,
        insuranceCompany: { select: { name: true } },
        vehicle: { select: { thirdPartySecure: true, secure: true } },
      },
    }),
    // Egresos del mes: vehículos que salieron del taller. Consideramos
    // egresados a todos los repairs que ya pasaron el punto de entrega
    // (status en {pendientes_cobro, experiencia_cliente, archivado}) y
    // cuyo "momento de egreso" cae en el mes. Ese momento es la primera
    // fecha disponible en la cascada:
    //   1. `deliveredAt` — si el admin la cargó en el form
    //   2. `archivedAt`  — para los que se arrastraron directo al archivo
    //   3. `updatedAt`   — último recurso para los que se arrastraron a
    //                      pendientes_cobro sin cargar la fecha
    // Con OR sobre esos tres campos capturamos el egreso real sin que se
    // pierdan los cards movidos por drag&drop.
    prisma.repair.findMany({
      where: {
        status: { in: ["pendientes_cobro", "experiencia_cliente", "archivado"] },
        OR: [
          { deliveredAt: { gte: startOfMonth, lt: startOfNextMonth } },
          {
            AND: [
              { deliveredAt: null },
              { archivedAt: { gte: startOfMonth, lt: startOfNextMonth } },
            ],
          },
          {
            AND: [
              { deliveredAt: null },
              { archivedAt: null },
              { updatedAt: { gte: startOfMonth, lt: startOfNextMonth } },
            ],
          },
        ],
      },
      select: {
        id: true,
        internalNumber: true,
        customerName: true,
        vehicleBrand: true,
        vehicleModel: true,
        vehicleDomain: true,
        insuranceCompany: true,
        deliveredAt: true,
        archivedAt: true,
        updatedAt: true,
        status: true,
      },
      orderBy: [
        { deliveredAt: "desc" },
        { archivedAt: "desc" },
        { updatedAt: "desc" },
      ],
    }),
    // Ingresos del mes: vehículos que físicamente entraron al taller
    // (enteredAt es el momento en que el mecánico marca "ingresó"). No
    // usamos createdAt porque el repair se puede crear con anticipación
    // desde la asignación de turno.
    prisma.repair.findMany({
      where: {
        enteredAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
      select: {
        id: true,
        internalNumber: true,
        customerName: true,
        vehicleBrand: true,
        vehicleModel: true,
        vehicleDomain: true,
        insuranceCompany: true,
        enteredAt: true,
      },
      orderBy: { enteredAt: "desc" },
    }),
  ]);

  // ── Cotizaciones (Lead funnel — snapshot actual por columna)
  const leadByStatus = new Map<string, number>();
  for (const r of leadCounts) leadByStatus.set(r.status, r._count);

  const cotizacionesByStage = LEAD_STAGES.map((s) => ({
    stage: s,
    count: leadByStatus.get(s) ?? 0,
  }));

  // spec 3.1 v2 · Tasa de conversión mensual: ganados/(ganados+perdidos) del
  // mes. Ganados imputados por orderReceivedAt, perdidos por updatedAt.
  const closedTotal = wonThisMonth + lostThisMonth;
  const conversionRate =
    closedTotal > 0 ? Math.round((wonThisMonth / closedTotal) * 100) : 0;

  // ── Producción (Repair)
  const repairByStatus = new Map<string, number>();
  for (const r of repairCounts) repairByStatus.set(r.status, r._count);

  const produccionByStage = REPAIR_STAGES.map((s) => ({
    stage: s,
    count: repairByStatus.get(s) ?? 0,
  }));

  // spec 2.2 v2 · totalActive = vehículos en taller (solo Turno Asignado →
  // Calidad). El breakdown por columna sigue mostrando todas las etapas.
  const totalActive = IN_SHOP_STAGES.reduce(
    (acc, s) => acc + (repairByStatus.get(s) ?? 0),
    0,
  );

  // ── Desglose mensual por compañía (spec 3.1 v2 — por Seguro Responsable)
  // Para cada bucket calculamos { total, aprobados } sobre los Leads del mes.
  // "Aprobado" acá = Lead.status === "ganado" (recibió orden de trabajo).
  const buckets: InsuranceBucket[] = [
    "NORTE",
    "SANCOR",
    "SAN_CRIST",
    "OTROS",
    "PARTICULARES",
    "SIN_DEFINIR",
  ];
  const insuranceStats: Record<
    InsuranceBucket,
    { total: number; accepted: number }
  > = {
    NORTE: { total: 0, accepted: 0 },
    SANCOR: { total: 0, accepted: 0 },
    SAN_CRIST: { total: 0, accepted: 0 },
    OTROS: { total: 0, accepted: 0 },
    PARTICULARES: { total: 0, accepted: 0 },
    SIN_DEFINIR: { total: 0, accepted: 0 },
  };
  for (const l of monthLeads) {
    let key: InsuranceBucket;
    if (!l.insuranceResponsibility) {
      key = "SIN_DEFINIR";
    } else if (l.insuranceResponsibility === "particular") {
      key = "PARTICULARES";
    } else if (l.insuranceResponsibility === "propio") {
      // Nombre de la compañía del titular: preferimos la relación
      // Lead.insuranceCompany (dato normalizado); fallback al string libre
      // Vehicle.secure para leads antiguos sin FK cargada.
      key = bucketByCompanyName(
        l.insuranceCompany?.name ?? l.vehicle?.secure ?? null,
      );
    } else {
      // tercero → compañía del tercero (string libre en Vehicle)
      key = bucketByCompanyName(l.vehicle?.thirdPartySecure ?? null);
    }
    insuranceStats[key].total += 1;
    if (l.status === "ganado") insuranceStats[key].accepted += 1;
  }
  const byInsurance = buckets.map((key) => ({
    key,
    total: insuranceStats[key].total,
    accepted: insuranceStats[key].accepted,
  }));
  const monthTotal = byInsurance.reduce((a, b) => a + b.total, 0);
  const monthAccepted = byInsurance.reduce((a, b) => a + b.accepted, 0);

  return NextResponse.json({
    cotizaciones: {
      totalYear: leadsYear,
      totalMonth: leadsMonth,
      byStage: cotizacionesByStage,
      conversionRate,
      won: wonThisMonth,
      lost: lostThisMonth,
      closedTotal,
    },
    produccion: {
      totalActive,
      byStage: produccionByStage,
      completedThisMonth: completedMonth,
    },
    porCompania: {
      month: `${startOfMonth.getFullYear()}-${String(
        startOfMonth.getMonth() + 1,
      ).padStart(2, "0")}`,
      total: monthTotal,
      accepted: monthAccepted,
      byInsurance,
    },
    egresos: {
      month: `${startOfMonth.getFullYear()}-${String(
        startOfMonth.getMonth() + 1,
      ).padStart(2, "0")}`,
      total: deliveredList.length,
      list: deliveredList.map((r) => ({
        id: r.id,
        internalNumber: r.internalNumber,
        customerName: r.customerName,
        vehicle: `${r.vehicleBrand} ${r.vehicleModel}`.trim(),
        domain: r.vehicleDomain,
        insurance: r.insuranceCompany,
        // Cascada de fecha de egreso: deliveredAt > archivedAt > updatedAt.
        // Marcamos con `dateSource` de dónde viene por si el frontend quiere
        // aclararlo (ej: "aprox." para los que caen a updatedAt).
        deliveredAt: r.deliveredAt ?? r.archivedAt ?? r.updatedAt,
        dateSource: r.deliveredAt
          ? "delivered"
          : r.archivedAt
            ? "archived"
            : "updated",
        status: r.status,
      })),
    },
    ingresos: {
      month: `${startOfMonth.getFullYear()}-${String(
        startOfMonth.getMonth() + 1,
      ).padStart(2, "0")}`,
      total: enteredList.length,
      list: enteredList.map((r) => ({
        id: r.id,
        internalNumber: r.internalNumber,
        customerName: r.customerName,
        vehicle: `${r.vehicleBrand} ${r.vehicleModel}`.trim(),
        domain: r.vehicleDomain,
        insurance: r.insuranceCompany,
        enteredAt: r.enteredAt,
      })),
    },
  });
}
