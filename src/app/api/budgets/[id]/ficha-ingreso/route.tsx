/**
 * POST /api/budgets/[id]/ficha-ingreso
 * Devuelve el PDF de la Ficha de Ingreso/Egreso (la que firma el cliente al
 * ingresar y al retirar el vehículo).
 *
 * Body JSON (todo opcional):
 *   {
 *     date?: string ("DD/MM/YYYY")
 *     insurance?: string         // resaltado amarillo (compañía de seguros)
 *     technicalInsurance?: string // resaltado amarillo (seg. técnico / tercero)
 *     franchiseAmount?: string   // resaltado amarillo, ya formateado o "-"
 *     franchiseLabel?: string    // texto editable: "Monto de franquicia a abonar..." o "Monto a abonar..." (particular)
 *     paymentCondition?: string
 *     customerName?: string
 *     customerAddress?: string
 *     customerLocality?: string
 *     customerPhone?: string
 *   }
 */

import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import {
  FichaIngresoPdf,
  type FichaIngresoData,
} from "@/lib/pdf/ficha-ingreso-pdf";
import { resolvePdfLogo } from "@/lib/pdf/logo";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

type RouteContext = { params: Promise<{ id: string }> };

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

function fmtToday() {
  return new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function pickStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const overrides = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const budget = await prisma.budget.findUnique({
    where: { id },
    include: {
      lead: {
        include: {
          customer: {
            select: { dni: true, address: true, city: true },
          },
          vehicle: { select: { thirdPartySecure: true } },
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
  const logoUrl = await resolvePdfLogo(settings.companyLogoUrl);

  // Defaults: franquicia formateada como ARS si está, "-" si no.
  const defaultFranchise =
    budget.insuranceFranchise !== null
      ? ARS.format(Number(budget.insuranceFranchise))
      : "-";

  // Si el presupuesto tiene seguro o franquicia cargados, asumimos caso por
  // seguro y mantenemos "de franquicia" en el texto. Si no, lo sacamos
  // (caso particular). El operador puede editar libremente desde la UI.
  const isFranchiseCase =
    !!budget.vehicleInsurance || budget.insuranceFranchise !== null;
  const defaultFranchiseLabel = isFranchiseCase
    ? "Monto de franquicia a abonar en efectivo al retirar el rodado:"
    : "Monto a abonar en efectivo al retirar el rodado:";

  const data: FichaIngresoData = {
    date: pickStr(overrides.date) ?? fmtToday(),
    budgetNumber: budget.number,
    customer: {
      name: pickStr(overrides.customerName) ?? budget.customerName,
      address:
        pickStr(overrides.customerAddress) ??
        (budget.customerAddress && budget.customerAddress !== "-"
          ? budget.customerAddress
          : (budget.lead.customer.address ?? "")),
      locality:
        pickStr(overrides.customerLocality) ??
        (budget.lead.customer.city ?? ""),
      phone: pickStr(overrides.customerPhone) ?? budget.customerPhone,
      dni: budget.customerDni ?? budget.lead.customer.dni ?? null,
    },
    vehicle: {
      brandModel: `${budget.vehicleBrand} ${budget.vehicleModel}`.trim(),
      year: budget.vehicleYear,
      domain: budget.vehicleDomain,
    },
    highlights: {
      insurance: pickStr(overrides.insurance) ?? (budget.vehicleInsurance ?? ""),
      technicalInsurance:
        pickStr(overrides.technicalInsurance) ??
        (budget.lead.vehicle?.thirdPartySecure ?? ""),
      franchiseAmount: pickStr(overrides.franchiseAmount) ?? defaultFranchise,
    },
    franchiseLabel:
      pickStr(overrides.franchiseLabel) ?? defaultFranchiseLabel,
    paymentCondition:
      pickStr(overrides.paymentCondition) ?? budget.paymentCondition,
    company: {
      name: settings.companyName,
      address: settings.companyAddress,
      phone: settings.companyPhone ?? "—",
      email: settings.companyEmail ?? "",
      logoUrl,
    },
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(<FichaIngresoPdf data={data} />);
  } catch (e) {
    console.error("Ficha Ingreso PDF render error:", e);
    return NextResponse.json(
      { error: "No se pudo generar la Ficha de Ingreso" },
      { status: 500 },
    );
  }

  const filename = `FichaIngreso-${budget.number}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "private, no-cache",
    },
  });
}
