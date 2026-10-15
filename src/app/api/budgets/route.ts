import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { BudgetStatus, Prisma } from "../../../../generated/prisma/client";

const STATUSES: BudgetStatus[] = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
];

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const status = url.searchParams.get("status") as BudgetStatus | null;
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  // Origen del lead ("pautas", "whatsapp", "referido"…). Permite responder
  // cuánto presupuestamos de lo que entró por publicidad.
  const source = url.searchParams.get("source")?.trim() || null;
  // "464", "#464" o "INT-464": buscar por N° interno de la tarjeta.
  const intMatch = search.match(/^(?:int-?|#)?(\d+)$/i);
  const internalNumber = intMatch ? Number(intMatch[1]) : null;
  // A la tarjeta se llega por el principal (Repair.budgetId), por siniestro,
  // o —en una ampliación— por el padre.
  const byInternal = (n: number): Prisma.BudgetWhereInput[] => [
    { repair: { internalNumber: n } },
    { claim: { repair: { internalNumber: n } } },
    { parentBudget: { repair: { internalNumber: n } } },
    { parentBudget: { claim: { repair: { internalNumber: n } } } },
  ];
  const amountMin = url.searchParams.get("amountMin");
  const amountMax = url.searchParams.get("amountMax");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

  const where: Prisma.BudgetWhereInput = {
    ...(status && STATUSES.includes(status) && { status }),
    ...(source && { lead: { source } }),
    ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
    ...(dateTo && {
      createdAt: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        lte: new Date(dateTo),
      },
    }),
    ...(search && {
      OR: [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { vehicleDomain: { contains: search, mode: "insensitive" } },
        { vehicleBrand: { contains: search, mode: "insensitive" } },
        { vehicleModel: { contains: search, mode: "insensitive" } },
        ...(internalNumber !== null ? byInternal(internalNumber) : []),
      ],
    }),
    ...(amountMin && { grandTotal: { gte: Number(amountMin) } }),
    ...(amountMax && {
      grandTotal: {
        ...(amountMin ? { gte: Number(amountMin) } : {}),
        lte: Number(amountMax),
      },
    }),
  };

  const budgets = await prisma.budget.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      leadId: true,
      number: true,
      status: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      vehicleBrand: true,
      vehicleModel: true,
      vehicleYear: true,
      vehicleDomain: true,
      laborTotal: true,
      partsSubtotal: true,
      grandTotal: true,
      validityDays: true,
      sentAt: true,
      acceptedAt: true,
      rejectedAt: true,
      createdAt: true,
      updatedAt: true,
      // Fuente del lead: la columna "Origen" de Cotizaciones y su filtro.
      lead: { select: { source: true } },
      // N° interno de la tarjeta de Producción: el id único del caso.
      repair: { select: { internalNumber: true } },
      claim: { select: { repair: { select: { internalNumber: true } } } },
      parentBudget: {
        select: {
          repair: { select: { internalNumber: true } },
          claim: { select: { repair: { select: { internalNumber: true } } } },
        },
      },
    },
  });

  // Aplanamos `lead.source` a `source` para que la fila del listado no tenga
  // que conocer la forma de la relación.
  return NextResponse.json({
    budgets: budgets.map(({ lead, repair, claim, parentBudget, ...b }) => ({
      ...b,
      source: lead?.source ?? null,
      internalNumber:
        repair?.internalNumber ??
        claim?.repair.internalNumber ??
        parentBudget?.repair?.internalNumber ??
        parentBudget?.claim?.repair.internalNumber ??
        null,
    })),
  });
}
