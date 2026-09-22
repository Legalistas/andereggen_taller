/**
 * GET /api/repairs/by-internal-number?n=<numero>
 *
 * spec v2 · Devuelve un repair por su `internalNumber` con las facturas y
 * saldos actuales. Usado por el módulo Caja para vincular un INGRESO
 * al cliente al que corresponde el cobro — así impacta también en la
 * sección "Facturación y cobros" de la ficha del vehículo.
 *
 * 404 si el N° interno no existe. Devuelve saldo pendiente por factura
 * para que el operador elija fácil cuál cobrar.
 *
 * spec Producción v4 · El N° interno dejó de ser único (un cliente con dos
 * siniestros puede repetirlo), así que puede haber varias coincidencias:
 * devolvemos la más relevante — activa antes que archivada, y dentro de eso
 * la última tocada — junto con `duplicates`, para que Caja avise en vez de
 * vincular el cobro al vehículo equivocado en silencio.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const raw = url.searchParams.get("n")?.trim();
  if (!raw) {
    return NextResponse.json({ error: "Falta N° interno" }, { status: 400 });
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return NextResponse.json(
      { error: "N° interno debe ser un entero positivo" },
      { status: 400 },
    );
  }

  const matches = await prisma.repair.findMany({
    where: { internalNumber: n },
    // Activas primero (archivedAt null ordena primero con "asc" en Postgres
    // usando nulls first), después la más recientemente actualizada.
    orderBy: [{ archivedAt: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      internalNumber: true,
      customerName: true,
      vehicleBrand: true,
      vehicleModel: true,
      vehicleDomain: true,
      status: true,
      invoices: {
        orderBy: { issuedAt: "asc" },
        select: {
          id: true,
          number: true,
          amount: true,
          recipient: true,
          recipientName: true,
          payments: { select: { amount: true } },
        },
      },
    },
  });
  const repair = matches[0];
  if (!repair) {
    return NextResponse.json(
      { error: `No hay ningún vehículo con Nº interno ${n}` },
      { status: 404 },
    );
  }

  return NextResponse.json({
    // Las otras tarjetas que comparten el N° interno. Caja las muestra como
    // aviso para que el operador confirme que está cobrando la correcta.
    duplicates: matches.slice(1).map((r) => ({
      id: r.id,
      customerName: r.customerName,
      vehicleSummary: `${r.vehicleBrand} ${r.vehicleModel}`.trim(),
      vehicleDomain: r.vehicleDomain,
      status: r.status,
    })),
    repair: {
      id: repair.id,
      internalNumber: repair.internalNumber,
      customerName: repair.customerName,
      vehicleSummary: `${repair.vehicleBrand} ${repair.vehicleModel}`.trim(),
      vehicleDomain: repair.vehicleDomain,
      status: repair.status,
      invoices: repair.invoices.map((inv) => {
        const paid = inv.payments.reduce((a, p) => a + Number(p.amount), 0);
        const total = Number(inv.amount);
        return {
          id: inv.id,
          number: inv.number,
          amount: total,
          paid,
          remaining: Math.max(0, total - paid),
          recipient: inv.recipient,
          recipientName: inv.recipientName,
        };
      }),
    },
  });
}
