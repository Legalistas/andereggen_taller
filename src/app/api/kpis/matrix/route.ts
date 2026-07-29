/**
 * GET /api/kpis/matrix?year=YYYY
 *
 * spec KPIs jul '26 · Tablero mensual consolidado. Devuelve, para el año
 * solicitado, la serie de 12 valores (ene-dic) de CADA métrica del
 * catálogo. El frontend calcula VMA y semáforo a partir de esa serie.
 *
 * Un solo endpoint agregador (vs Legalistas que hace N paralelos por mes)
 * porque:
 *   - Volumen del taller es chico (miles de leads/repairs por año, no
 *     millones), no vale la pena la complejidad.
 *   - Todas las queries son groupBy con `date_trunc('month', ...)`, se
 *     resuelven en 1 round-trip por serie.
 *
 * Roles:
 *   - Los grupos "restringidos" (Caja/Finanzas) sólo se devuelven si el
 *     rol del user está en `KPI_RESTRICTED_ROLES`. El frontend igual gate
 *     visualmente, pero acá reforzamos por seguridad.
 */

import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import {
  type InsuranceKey,
  KPI_GROUPS,
  KPI_INSURANCE_COMPANIES,
  KPI_RESTRICTED_ROLES,
  type KpiGroupKey,
} from "@/lib/kpis/catalog";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type NumberSeries = Array<number>;
type NullableSeries = Array<number | null>;
/** Alias público para la serie que se manda al frontend. Puede tener null
 *  en índices donde no aplica cálculo (ej: tasa de conversión con 0 leads
 *  creados, tiempo promedio sin entregas). */
type MonthlySeries = NullableSeries;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const zeros12 = (): NumberSeries => Array(12).fill(0) as NumberSeries;
const nulls12 = (): NullableSeries =>
  Array(12).fill(null) as NullableSeries;

function monthIndexOf(d: Date): number {
  return d.getMonth();
}

function bucketByCompany(name: string | null): InsuranceKey | null {
  if (!name?.trim()) return null;
  const v = name.toLowerCase();
  for (const c of KPI_INSURANCE_COMPANIES) {
    if (v.includes(c.match)) return c.key;
  }
  return "otras";
}

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();

  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "year inválido" }, { status: 400 });
  }

  const startOfYear = new Date(year, 0, 1);
  const startOfNextYear = new Date(year + 1, 0, 1);

  const roleName = session?.user?.domainRole?.name ?? null;
  const canSeeRestricted =
    roleName !== null && KPI_RESTRICTED_ROLES.has(roleName);

  // ─── COTIZACIONES ─────────────────────────────────────────
  // Todo por Lead ID: creadas por Lead.createdAt, ganadas por
  // Lead.orderReceivedAt (spec 1.1/3.1: se imputa al mes de la orden).
  const [
    leadsCreated,
    leadsWon,
    manualEntries,
  ] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: startOfYear, lt: startOfNextYear } },
      select: {
        createdAt: true,
        insuranceResponsibility: true,
        insuranceCompany: { select: { name: true } },
        vehicle: { select: { secure: true } },
      },
    }),
    prisma.lead.findMany({
      where: {
        status: "ganado",
        orderReceivedAt: { gte: startOfYear, lt: startOfNextYear },
      },
      select: {
        orderReceivedAt: true,
        insuranceResponsibility: true,
        insuranceCompany: { select: { name: true } },
        vehicle: { select: { secure: true } },
      },
    }),
    prisma.monthlyKpiEntry.findMany({
      where: { year },
    }),
  ]);

  const cotCreadas: NumberSeries = zeros12();
  const cotGanadas: NumberSeries = zeros12();
  // Buckets por compañía — pre-inicializados con arrays de 12 ceros.
  const buildCompanyBuckets = (): Record<string, NumberSeries> => {
    const out: Record<string, NumberSeries> = {
      norte: zeros12(),
      sancor: zeros12(),
      san_crist: zeros12(),
      segunda: zeros12(),
      otras: zeros12(),
      particulares: zeros12(),
    };
    return out;
  };
  const cotCreadasBy = buildCompanyBuckets();
  const cotGanadasBy = buildCompanyBuckets();

  const routeLeadToBucket = (lead: {
    insuranceResponsibility: string | null;
    insuranceCompany: { name: string | null } | null;
    vehicle: { secure: string | null } | null;
  }): InsuranceKey => {
    if (lead.insuranceResponsibility === "particular") return "particulares";
    const name = lead.insuranceCompany?.name ?? lead.vehicle?.secure ?? null;
    return bucketByCompany(name) ?? "otras";
  };

  for (const l of leadsCreated) {
    const m = monthIndexOf(l.createdAt);
    cotCreadas[m] = (cotCreadas[m] ?? 0) + 1;
    const bucket = routeLeadToBucket(l);
    cotCreadasBy[bucket][m] = (cotCreadasBy[bucket][m] ?? 0) + 1;
  }
  for (const l of leadsWon) {
    if (!l.orderReceivedAt) continue;
    const m = monthIndexOf(l.orderReceivedAt);
    cotGanadas[m] = (cotGanadas[m] ?? 0) + 1;
    const bucket = routeLeadToBucket(l);
    cotGanadasBy[bucket][m] = (cotGanadasBy[bucket][m] ?? 0) + 1;
  }

  // Tasa de conversión mensual
  const cotConversion: MonthlySeries = cotCreadas.map((created, i) => {
    const c = created ?? 0;
    if (c === 0) return null;
    return ((cotGanadas[i] ?? 0) / c) * 100;
  });

  // ─── PRODUCCIÓN ───────────────────────────────────────────
  const [entered, delivered, timePerRepair] = await Promise.all([
    prisma.repair.findMany({
      where: { enteredAt: { gte: startOfYear, lt: startOfNextYear } },
      select: { enteredAt: true },
    }),
    prisma.repair.findMany({
      where: { deliveredAt: { gte: startOfYear, lt: startOfNextYear } },
      select: { deliveredAt: true, enteredAt: true },
    }),
    // Repairs entregados en el año con enteredAt cargado — usamos para el
    // promedio de días en taller.
    prisma.repair.findMany({
      where: {
        deliveredAt: { gte: startOfYear, lt: startOfNextYear },
        enteredAt: { not: null },
      },
      select: { deliveredAt: true, enteredAt: true },
    }),
  ]);

  const prodIngresados: NumberSeries = zeros12();
  const prodEntregados: NumberSeries = zeros12();
  for (const r of entered) {
    if (!r.enteredAt) continue;
    prodIngresados[monthIndexOf(r.enteredAt)] += 1;
  }
  for (const r of delivered) {
    if (!r.deliveredAt) continue;
    prodEntregados[monthIndexOf(r.deliveredAt)] += 1;
  }

  // Tiempo promedio: agrupar por mes de deliveredAt.
  const timeSum: NumberSeries = zeros12();
  const timeCount: NumberSeries = zeros12();
  for (const r of timePerRepair) {
    if (!r.deliveredAt || !r.enteredAt) continue;
    const days =
      (r.deliveredAt.getTime() - r.enteredAt.getTime()) / (86400 * 1000);
    if (days <= 0) continue;
    const m = monthIndexOf(r.deliveredAt);
    timeSum[m] += days;
    timeCount[m] += 1;
  }
  const prodTiempoTaller: MonthlySeries = timeSum.map((s, i) =>
    timeCount[i] > 0 ? s / (timeCount[i] as number) : null,
  );

  // Reclamos (manual) — leer del `MonthlyKpiEntry`.
  const prodReclamos: MonthlySeries = nulls12();
  for (const e of manualEntries) {
    if (e.metricKey === "produccion.reclamos") {
      prodReclamos[e.month - 1] = Number(e.value);
    }
  }

  // ─── CAJA / FINANZAS (restricted) ─────────────────────────
  let cajaSeries: {
    facturacion: MonthlySeries;
    ingresos: MonthlySeries;
    egresos: MonthlySeries;
    pendientes: MonthlySeries;
    ingresosBy: Record<string, NumberSeries>;
  } | null = null;

  if (canSeeRestricted) {
    const [invoices, payments, egresos, allInvoices] = await Promise.all([
      // Facturación = RepairInvoice.amount emitidas en el mes
      prisma.repairInvoice.findMany({
        where: { issuedAt: { gte: startOfYear, lt: startOfNextYear } },
        select: { issuedAt: true, amount: true },
      }),
      // Ingresos = pagos oficiales (excluye Caja 2)
      prisma.repairInvoicePayment.findMany({
        where: {
          paidAt: { gte: startOfYear, lt: startOfNextYear },
          OR: [
            { cashBoxId: null },
            { cashBox: { key: { not: "caja_2" } } },
          ],
        },
        select: {
          paidAt: true,
          amount: true,
          invoice: {
            select: {
              repair: {
                select: {
                  insuranceCompany: true,
                  lead: {
                    select: {
                      insuranceResponsibility: true,
                      insuranceCompany: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      // Egresos manuales del año (excluye pases)
      prisma.cashMovement.findMany({
        where: {
          type: "EGRESO",
          paidAt: { gte: startOfYear, lt: startOfNextYear },
        },
        select: { paidAt: true, amount: true, concept: true },
      }),
      // Cobros pendientes: para cada factura calculamos el saldo al cierre
      // de cada mes. Simplificación: usamos snapshot ACTUAL (no historial
      // real) — más práctico para el uso diario. Si hace falta el snapshot
      // exacto de cierre, se re-calcula por período.
      prisma.repairInvoice.findMany({
        select: {
          amount: true,
          payments: { select: { amount: true, paidAt: true } },
        },
      }),
    ]);

    const facturacion: NumberSeries = zeros12();
    for (const inv of invoices) {
      facturacion[monthIndexOf(inv.issuedAt)] += Number(inv.amount);
    }

    const ingresos: NumberSeries = zeros12();
    const ingresosBy: Record<string, NumberSeries> = {
      norte: zeros12(),
      sancor: zeros12(),
      san_crist: zeros12(),
      segunda: zeros12(),
      otras: zeros12(),
      particulares: zeros12(),
    };
    for (const p of payments) {
      const m = monthIndexOf(p.paidAt);
      const amt = Number(p.amount);
      ingresos[m] += amt;
      const lead = p.invoice.repair.lead;
      let bucket: InsuranceKey;
      if (lead?.insuranceResponsibility === "particular") {
        bucket = "particulares";
      } else {
        bucket =
          bucketByCompany(
            lead?.insuranceCompany?.name ?? p.invoice.repair.insuranceCompany,
          ) ?? "otras";
      }
      ingresosBy[bucket][m] += amt;
    }

    const egresosSeries: NumberSeries = zeros12();
    for (const e of egresos) {
      egresosSeries[monthIndexOf(e.paidAt)] += Number(e.amount);
    }

    // Cobros pendientes: monto por cobrar al cierre de cada mes.
    // Para cada factura: si issuedAt cae dentro del año, el "saldo al fin
    // del mes M" = amount - sum(payments hasta fin de M). Iteramos meses.
    // Nota: la implementación simple (sin snapshot histórico) es acumular
    // al mes actual el saldo actual del sistema — para el brief basta.
    const pendientes: NumberSeries = zeros12();
    for (let m = 0; m < 12; m++) {
      const cutoff = new Date(year, m + 1, 1); // inicio del siguiente mes
      let total = 0;
      for (const inv of allInvoices) {
        const invAmount = Number(inv.amount);
        // Solo cuentan facturas cuyos pagos se emitieron antes o durante
        // el mes M (simplificación: consideramos toda factura del año en
        // el cierre de mes correspondiente).
        const paidUpToCutoff = inv.payments
          .filter((p) => p.paidAt < cutoff)
          .reduce((a, p) => a + Number(p.amount), 0);
        const saldo = invAmount - paidUpToCutoff;
        if (saldo > 0) total += saldo;
      }
      pendientes[m] = total;
    }

    cajaSeries = {
      facturacion,
      ingresos,
      egresos: egresosSeries,
      pendientes,
      ingresosBy,
    };
  }

  // ─── COMPRAS ──────────────────────────────────────────────
  // Compras de repuestos = egresos con concepto "Repuestos"
  // Compras de insumos = egresos con concepto "Insumos" (a agregar al
  // catálogo si aún no existe — por ahora matchea concepto exacto).
  const comprasEgresos = await prisma.cashMovement.findMany({
    where: {
      type: "EGRESO",
      paidAt: { gte: startOfYear, lt: startOfNextYear },
    },
    select: { paidAt: true, amount: true, concept: true },
  });
  const comprasRepuestos: NumberSeries = zeros12();
  const comprasInsumos: NumberSeries = zeros12();
  for (const e of comprasEgresos) {
    const m = monthIndexOf(e.paidAt);
    const amt = Number(e.amount);
    const concept = e.concept.toLowerCase();
    if (concept === "repuestos") comprasRepuestos[m] += amt;
    else if (concept === "insumos") comprasInsumos[m] += amt;
  }

  // ─── Ensamble del payload ────────────────────────────────
  const seriesByKey: Record<string, MonthlySeries> = {
    "cotizaciones.creadas": cotCreadas,
    "cotizaciones.ganadas": cotGanadas,
    "cotizaciones.conversion": cotConversion,
    "cotizaciones.creadas_norte": cotCreadasBy.norte,
    "cotizaciones.creadas_sancor": cotCreadasBy.sancor,
    "cotizaciones.creadas_san_crist": cotCreadasBy.san_crist,
    "cotizaciones.creadas_segunda": cotCreadasBy.segunda,
    "cotizaciones.creadas_otras": cotCreadasBy.otras,
    "cotizaciones.creadas_particulares": cotCreadasBy.particulares,
    "cotizaciones.ganadas_norte": cotGanadasBy.norte,
    "cotizaciones.ganadas_sancor": cotGanadasBy.sancor,
    "cotizaciones.ganadas_san_crist": cotGanadasBy.san_crist,
    "cotizaciones.ganadas_segunda": cotGanadasBy.segunda,
    "cotizaciones.ganadas_otras": cotGanadasBy.otras,
    "cotizaciones.ganadas_particulares": cotGanadasBy.particulares,
    "produccion.ingresados": prodIngresados,
    "produccion.entregados": prodEntregados,
    "produccion.tiempo_taller": prodTiempoTaller,
    "produccion.reclamos": prodReclamos,
    "compras.repuestos": comprasRepuestos,
    "compras.insumos": comprasInsumos,
  };

  if (cajaSeries) {
    seriesByKey["caja.facturacion"] = cajaSeries.facturacion;
    seriesByKey["caja.ingresos"] = cajaSeries.ingresos;
    seriesByKey["caja.egresos"] = cajaSeries.egresos;
    seriesByKey["caja.pendientes"] = cajaSeries.pendientes;
    seriesByKey["caja.ingresos_norte"] = cajaSeries.ingresosBy.norte;
    seriesByKey["caja.ingresos_sancor"] = cajaSeries.ingresosBy.sancor;
    seriesByKey["caja.ingresos_san_crist"] = cajaSeries.ingresosBy.san_crist;
    seriesByKey["caja.ingresos_segunda"] = cajaSeries.ingresosBy.segunda;
    seriesByKey["caja.ingresos_otras"] = cajaSeries.ingresosBy.otras;
    seriesByKey["caja.ingresos_particulares"] =
      cajaSeries.ingresosBy.particulares;
  }

  // Filtrar grupos que el user no puede ver.
  const visibleGroups: KpiGroupKey[] = KPI_GROUPS.filter(
    (g) => !g.restricted || canSeeRestricted,
  ).map((g) => g.key);

  return NextResponse.json({
    year,
    canSeeRestricted,
    visibleGroups,
    series: seriesByKey,
  });
}
