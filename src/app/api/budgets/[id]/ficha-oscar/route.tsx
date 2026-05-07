/**
 * POST /api/budgets/[id]/ficha-oscar
 * Devuelve el PDF de la "Ficha Oscar" — interno, se imprime ANTES de
 * enviar el presupuesto para que Oscar/Alfredo lo finalicen.
 *
 * Sin body — toma todo del budget (cliente, vehículo, conceptos
 * descriptivos, observaciones, items administrativos con cotizaciones).
 */

import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { CATEGORY_BY_KEY, subdetailLabel } from "@/lib/budget-catalog";
import {
  type FichaOscarData,
  FichaOscarPdf,
  type FichaOscarSection,
} from "@/lib/pdf/ficha-oscar-pdf";
import { resolvePdfLogo } from "@/lib/pdf/logo";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import type {
  ConceptCategory,
  ConceptType,
} from "../../../../../../generated/prisma/client";

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

function buildSectionsFromBudget(
  concepts: Array<{
    type: ConceptType;
    category: ConceptCategory;
    subdetails: string[];
    additionalDetail: string | null;
  }>,
): FichaOscarSection[] {
  const sections: FichaOscarSection[] = [];
  for (const c of concepts) {
    if (c.type !== "DESCRIPTIVO") continue;
    const def = CATEGORY_BY_KEY[c.category];
    const title = (def?.label ?? c.category.replaceAll("_", " ")).toUpperCase();
    const bullets = c.subdetails.map((k) => subdetailLabel(c.category, k));
    if (c.additionalDetail?.trim()) {
      bullets.push(c.additionalDetail.trim());
    }
    if (bullets.length > 0) {
      sections.push({ title, bullets });
    }
  }
  return sections;
}

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const budget = await prisma.budget.findUnique({
    where: { id },
    include: {
      concepts: { orderBy: { order: "asc" } },
      lead: {
        include: {
          vehicle: { select: { thirdPartySecure: true } },
        },
      },
      adminItems: {
        orderBy: { order: "asc" },
        include: {
          quotes: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  // Notas: vienen del lead (sección "Notas" del canvas) — relato del cliente
  // / contexto del trabajo. Si además hay observations del budget, se anexan.
  function combineNotes(leadNotes?: string | null, budgetObs?: string | null) {
    const a = (leadNotes ?? "").trim();
    const b = (budgetObs ?? "").trim();
    if (a && b) return `${a}\n\n— Observaciones del presupuesto —\n${b}`;
    return a || b;
  }

  if (!budget) {
    return NextResponse.json(
      { error: "Presupuesto no encontrado" },
      { status: 404 },
    );
  }

  const settings = await getAppSettings();
  const logoUrl = await resolvePdfLogo(settings.companyLogoUrl);

  const sections = buildSectionsFromBudget(
    budget.concepts.map((c) => ({
      type: c.type,
      category: c.category,
      subdetails: c.subdetails,
      additionalDetail: c.additionalDetail,
    })),
  );

  const data: FichaOscarData = {
    date: fmtToday(),
    budgetNumber: budget.number,
    customer: { name: budget.customerName },
    vehicle: {
      brandModel: `${budget.vehicleBrand} ${budget.vehicleModel}`.trim(),
      domain: budget.vehicleDomain,
      year: budget.vehicleYear,
    },
    highlights: {
      insurance: budget.vehicleInsurance ?? "",
      technicalInsurance: budget.lead.vehicle?.thirdPartySecure ?? "",
    },
    notes: combineNotes(budget.lead.notes, budget.observations),
    sections,
    parts: budget.adminItems.map((it) => ({
      description: it.description,
      notes: it.notes,
      quotes: it.quotes.map((q) => ({
        supplierName: q.supplierName,
        price: ARS.format(Number(q.price)),
        notes: q.notes,
      })),
    })),
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
    pdfBuffer = await renderToBuffer(<FichaOscarPdf data={data} />);
  } catch (e) {
    console.error("Ficha Oscar PDF render error:", e);
    return NextResponse.json(
      { error: "No se pudo generar la Ficha Oscar" },
      { status: 500 },
    );
  }

  const filename = `FichaOscar-${budget.number}.pdf`;

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
