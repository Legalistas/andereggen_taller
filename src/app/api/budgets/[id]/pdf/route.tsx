/**
 * GET /api/budgets/[id]/pdf
 * Devuelve el PDF del presupuesto como descarga (Content-Disposition: attachment).
 * Usa el mismo BudgetPdf que el endpoint de envío por email.
 */

import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { BudgetPdf, type BudgetPdfData } from "@/lib/pdf/budget-pdf";
import { resolvePdfLogo } from "@/lib/pdf/logo";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const budget = await prisma.budget.findUnique({
    where: { id },
    include: {
      concepts: { orderBy: { order: "asc" } },
      parts: { orderBy: { order: "asc" } },
      lead: {
        select: {
          customer: { select: { dni: true, address: true } },
        },
      },
    },
  });

  if (!budget) {
    return NextResponse.json(
      { error: "Presupuesto no encontrado" },
      { status: 404 },
    );
  }

  const settings = await getAppSettings();

  // Logo: usa companyLogoUrl si está seteado; si no, lee /public/logo.png
  // del filesystem y devuelve data URI base64 (más confiable que fetch HTTP).
  const logoUrl = await resolvePdfLogo(settings.companyLogoUrl);

  const pdfData: BudgetPdfData = {
    number: budget.number,
    createdAt: budget.createdAt,
    customer: {
      name: budget.customerName,
      email: budget.customerEmail,
      phone: budget.customerPhone,
      dni: budget.customerDni ?? budget.lead.customer.dni ?? null,
      address: budget.customerAddress ?? budget.lead.customer.address ?? null,
    },
    vehicle: {
      brand: budget.vehicleBrand,
      model: budget.vehicleModel,
      year: budget.vehicleYear,
      domain: budget.vehicleDomain,
      insurance: budget.vehicleInsurance,
    },
    concepts: budget.concepts.map((c) => ({
      type: c.type as "DESCRIPTIVO" | "UNIDADES" | "FIJO",
      category: c.category,
      subdetails: c.subdetails,
      additionalDetail: c.additionalDetail,
      units: c.units ? Number(c.units) : null,
      unitValue: c.unitValue ? Number(c.unitValue) : null,
      fixedAmount: c.fixedAmount ? Number(c.fixedAmount) : null,
      fixedDescription: c.fixedDescription,
    })),
    parts: budget.parts.map((p) => ({
      quantity: Number(p.quantity),
      description: p.description,
      unitPrice: Number(p.unitPrice),
    })),
    totals: {
      laborSubtotal: Number(budget.laborSubtotal),
      ivaRate: Number(budget.ivaRate),
      ivaAmount: Number(budget.ivaAmount),
      laborTotal: Number(budget.laborTotal),
      partsSubtotal: Number(budget.partsSubtotal),
      grandTotal: Number(budget.grandTotal),
    },
    conditions: {
      validityDays: budget.validityDays,
      deliveryDays: budget.deliveryDays,
      paymentCondition: budget.paymentCondition,
      observations: budget.observations,
    },
    company: {
      name: settings.companyName,
      address: settings.companyAddress,
      phone: settings.companyPhone ?? "—",
      email: settings.companyEmail ?? "",
      cuit: settings.companyCuit,
      logoUrl,
    },
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(<BudgetPdf data={pdfData} />);
  } catch (e) {
    console.error("PDF render error:", e);
    return NextResponse.json(
      { error: "No se pudo generar el PDF del presupuesto" },
      { status: 500 },
    );
  }

  // Nombre amigable: "Presupuesto-3576-JORGE-SANGALLI.pdf"
  const safeName = budget.customerName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 40);
  const filename = `Presupuesto-${budget.number}-${safeName}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "private, no-cache",
    },
  });
}
