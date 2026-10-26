/**
 * GET /api/supplier-invoices?month=AAAA-MM&supplierId=  — facturas de compra del mes
 *
 * spec 13 · Facturas importadas de ARCA. Solo dirección y contable.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES } from "@/lib/roles";

export async function GET(request: Request) {
  const authError = await verifyAuth(request, FINANCE_ROLES);
  if (authError) return authError;

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
  }
  const supplierId = url.searchParams.get("supplierId") || undefined;
  const desde = new Date(`${month}-01T00:00:00.000Z`);
  const hasta = new Date(
    Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 1),
  );

  const facturas = await prisma.supplierInvoice.findMany({
    where: {
      date: { gte: desde, lt: hasta },
      ...(supplierId && { supplierId }),
    },
    include: {
      supplier: { select: { id: true, name: true, accountCode: true } },
    },
    orderBy: [{ date: "desc" }, { issuerName: "asc" }, { number: "desc" }],
  });

  const n = (d: unknown) => Number(d);
  return NextResponse.json({
    invoices: facturas.map((f) => ({
      id: f.id,
      date: f.date.toISOString().slice(0, 10),
      typeCode: f.typeCode,
      typeName: f.typeName,
      pointOfSale: f.pointOfSale,
      number: f.number,
      issuerCuit: f.issuerCuit,
      issuerName: f.issuerName,
      supplier: f.supplier,
      currency: f.currency,
      netTaxed: n(f.netTaxed),
      netUntaxed: n(f.netUntaxed),
      exempt: n(f.exempt),
      otherTaxes: n(f.otherTaxes),
      iva: n(f.iva),
      total: n(f.total),
    })),
  });
}
