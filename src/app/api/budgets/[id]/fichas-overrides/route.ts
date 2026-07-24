/**
 * PATCH /api/budgets/[id]/fichas-overrides
 *
 * spec v2 · Guarda las ediciones del dialog "Fichas" (Ficha Técnica + Ficha
 * Ingreso/Egreso) en el budget. Antes eran efímeras; ahora persisten así el
 * equipo puede reabrir el dialog y encontrar los cambios que hicieron.
 *
 * Body:
 *   {
 *     tecnica?: { color: string|null, sections: [{title, bullets: string[]}] },
 *     ingreso?: {
 *       date, insurance, technicalInsurance, franchiseAmount, franchiseLabel,
 *       paymentCondition, customerName, customerAddress, customerLocality,
 *       customerPhone
 *     }
 *   }
 *
 * Se acepta patch parcial: si sólo mandás `tecnica`, `ingreso` queda como
 * estaba.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

type Section = { title: string; bullets: string[] };
type TecnicaOverrides = { color: string | null; sections: Section[] };
type IngresoOverrides = {
  date: string;
  insurance: string;
  technicalInsurance: string;
  franchiseAmount: string;
  franchiseLabel: string;
  paymentCondition: string;
  customerName: string;
  customerAddress: string;
  customerLocality: string;
  customerPhone: string;
};
type FichasOverrides = {
  tecnica?: TecnicaOverrides;
  ingreso?: IngresoOverrides;
};

function sanitizeTecnica(v: unknown): TecnicaOverrides | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const color = typeof o.color === "string" ? o.color : null;
  const sectionsRaw = Array.isArray(o.sections) ? o.sections : [];
  const sections: Section[] = sectionsRaw
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const sec = s as Record<string, unknown>;
      const title = typeof sec.title === "string" ? sec.title : "";
      const bulletsRaw = Array.isArray(sec.bullets) ? sec.bullets : [];
      const bullets = bulletsRaw.filter(
        (b): b is string => typeof b === "string",
      );
      return { title, bullets };
    })
    .filter((s): s is Section => s !== null);
  return { color, sections };
}

function sanitizeIngreso(v: unknown): IngresoOverrides | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const str = (k: string): string => (typeof o[k] === "string" ? (o[k] as string) : "");
  return {
    date: str("date"),
    insurance: str("insurance"),
    technicalInsurance: str("technicalInsurance"),
    franchiseAmount: str("franchiseAmount"),
    franchiseLabel: str("franchiseLabel"),
    paymentCondition: str("paymentCondition"),
    customerName: str("customerName"),
    customerAddress: str("customerAddress"),
    customerLocality: str("customerLocality"),
    customerPhone: str("customerPhone"),
  };
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.budget.findUnique({
    where: { id },
    select: { fichasOverrides: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Budget no encontrado" }, { status: 404 });
  }

  // Merge parcial: si sólo viene `tecnica`, respetamos el `ingreso` guardado.
  const prev = (existing.fichasOverrides ?? {}) as FichasOverrides;
  const b = body as { tecnica?: unknown; ingreso?: unknown };
  const nextTecnica =
    b.tecnica !== undefined ? sanitizeTecnica(b.tecnica) : prev.tecnica;
  const nextIngreso =
    b.ingreso !== undefined ? sanitizeIngreso(b.ingreso) : prev.ingreso;

  const next: FichasOverrides = {
    ...(nextTecnica ? { tecnica: nextTecnica } : {}),
    ...(nextIngreso ? { ingreso: nextIngreso } : {}),
  };

  await prisma.budget.update({
    where: { id },
    data: { fichasOverrides: next },
  });

  return NextResponse.json({ ok: true, fichasOverrides: next });
}
