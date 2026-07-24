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

  const repair = await prisma.repair.findUnique({
    where: { internalNumber: n },
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
  if (!repair) {
    return NextResponse.json(
      { error: `No hay ningún vehículo con Nº interno ${n}` },
      { status: 404 },
    );
  }

  return NextResponse.json({
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
