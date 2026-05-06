/**
 * POST /api/budgets/[id]/ficha-tecnica
 * Devuelve el PDF de la Ficha Técnica para imprimir y pegar en el auto.
 *
 * Body JSON (todo opcional — si falta algo se rellena del budget/vehículo):
 *   {
 *     color?: string,
 *     sections?: Array<{ title: string, bullets: string[] }>
 *   }
 *
 * Si no se mandan `sections`, se arman automáticamente desde los conceptos
 * DESCRIPTIVOS del budget (label de categoría como header, subdetail labels
 * como bullets — incluyendo customs `custom:...`). El usuario puede editar
 * en el dialog antes de imprimir.
 */

import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { CATEGORY_BY_KEY, subdetailLabel } from "@/lib/budget-catalog";
import {
  type FichaTecnicaData,
  FichaTecnicaPdf,
  type FichaTecnicaSection,
} from "@/lib/pdf/ficha-tecnica-pdf";
import { resolvePdfLogo } from "@/lib/pdf/logo";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import type {
  ConceptCategory,
  ConceptType,
} from "../../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

/** Construye las secciones a partir de los conceptos DESCRIPTIVOS del budget. */
function buildSectionsFromBudget(
  concepts: Array<{
    type: ConceptType;
    category: ConceptCategory;
    subdetails: string[];
    additionalDetail: string | null;
  }>,
): FichaTecnicaSection[] {
  const sections: FichaTecnicaSection[] = [];
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

  const overrides = (await request.json().catch(() => ({}))) as {
    color?: string;
    sections?: FichaTecnicaSection[];
  };

  const budget = await prisma.budget.findUnique({
    where: { id },
    include: {
      concepts: { orderBy: { order: "asc" } },
      lead: {
        select: { vehicle: { select: { color: true } } },
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

  const sections =
    Array.isArray(overrides.sections) && overrides.sections.length > 0
      ? overrides.sections
          .map((s) => ({
            title: String(s.title ?? "").trim(),
            bullets: Array.isArray(s.bullets)
              ? s.bullets
                  .map((b) => String(b ?? "").trim())
                  .filter((b) => b !== "")
              : [],
          }))
          .filter((s) => s.title !== "" && s.bullets.length > 0)
      : buildSectionsFromBudget(
          budget.concepts.map((c) => ({
            type: c.type,
            category: c.category,
            subdetails: c.subdetails,
            additionalDetail: c.additionalDetail,
          })),
        );

  const data: FichaTecnicaData = {
    number: budget.number,
    vehicle: {
      brand: budget.vehicleBrand,
      model: budget.vehicleModel,
      year: budget.vehicleYear,
      domain: budget.vehicleDomain,
      color:
        typeof overrides.color === "string"
          ? overrides.color.trim() || null
          : (budget.lead.vehicle?.color ?? null),
    },
    sections,
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
    pdfBuffer = await renderToBuffer(<FichaTecnicaPdf data={data} />);
  } catch (e) {
    console.error("Ficha Técnica PDF render error:", e);
    return NextResponse.json(
      { error: "No se pudo generar la Ficha Técnica" },
      { status: 500 },
    );
  }

  const filename = `FichaTecnica-${budget.number}.pdf`;

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
