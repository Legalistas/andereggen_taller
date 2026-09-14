/**
 * GET  /api/purchases?status=&search=&budgetId=&repairId=&page=1&pageSize=25
 *                                                            — lista paginada
 * POST /api/purchases                                       — crea
 *
 * spec Compras v2 · Módulo general de compras.
 *
 * `GET` devuelve compras paginadas (default 25/pág, máx 200). Cada row
 * incluye el ítem, el budget (o el repair si es directCreation), el
 * proveedor de repuesto y el proveedor de flete. También devuelve
 * `countsByStatus` calculado SIN el filtro de status para que los badges
 * de los tabs no dependan del tab activo.
 *
 * `POST` crea una compra a partir de un `itemId`. Genera el `number`
 * atómicamente dentro de una transacción. El status default es `COTIZAR`.
 * Los campos de decisión (chosenQuoteId, supplier, amount) son opcionales
 * al crear — se van llenando por PATCH conforme avanza el ciclo.
 */

import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { PURCHASE_STATUS_KEYS } from "@/lib/purchases/catalog";
import {
  nextPurchaseNumber,
  nextPurchaseNumberDirect,
} from "@/lib/purchases/number";
import { prisma } from "@/lib/prisma";
import type { PurchaseStatus } from "../../../../generated/prisma/client";

// v3 · Shape del budget para compras directas y para el include del item.
const BUDGET_SELECT = {
  id: true,
  number: true,
  extensionSuffix: true,
  repair: {
    select: {
      id: true,
      internalNumber: true,
      vehicleBrand: true,
      vehicleModel: true,
      vehicleDomain: true,
      customerName: true,
    },
  },
} as const;

const PURCHASE_INCLUDE = {
  item: {
    include: {
      budget: { select: BUDGET_SELECT },
    },
  },
  // v3 · Budget directo (compras sin item, con presupuesto opcional).
  budget: { select: BUDGET_SELECT },
  chosenQuote: {
    select: {
      id: true,
      category: true,
      supplierName: true,
      price: true,
      discount: true,
      partCode: true,
    },
  },
  supplier: { select: { id: true, name: true } },
  freightSupplier: { select: { id: true, name: true } },
} as const;

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as PurchaseStatus | null;
  const search = url.searchParams.get("search")?.trim() ?? "";
  const budgetId = url.searchParams.get("budgetId");
  const repairId = url.searchParams.get("repairId");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const rawSize = Number(url.searchParams.get("pageSize") ?? "25");
  const pageSize = Math.min(
    200,
    Math.max(1, Number.isFinite(rawSize) ? rawSize : 25),
  );

  // Base filters SIN el status — se aplican tanto al listado paginado
  // como al conteo por status (así los badges de tabs no dependen del tab
  // activo).
  const baseWhere = {
    ...(budgetId && { item: { budgetId } }),
    ...(repairId && {
      item: { budget: { repair: { id: repairId } } },
    }),
    ...(search && {
      OR: [
        { number: { contains: search, mode: "insensitive" as const } },
        {
          item: {
            description: { contains: search, mode: "insensitive" as const },
          },
        },
        {
          supplierName: { contains: search, mode: "insensitive" as const },
        },
        {
          item: {
            budget: {
              repair: {
                OR: [
                  {
                    customerName: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    vehicleDomain: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    }),
  };

  const where = {
    ...baseWhere,
    ...(status && PURCHASE_STATUS_KEYS.has(status) && { status }),
  };

  const [total, purchases, byStatus, byItem] = await Promise.all([
    prisma.purchase.count({ where }),
    prisma.purchase.findMany({
      where,
      include: PURCHASE_INCLUDE,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    // Contadores + sumas por status con los MISMOS filtros base (search,
    // budgetId, repairId) pero SIN filtro de status — así los badges y el
    // summary no dependen del tab activo.
    // Perf audit: antes el summary hacía un findMany de TODAS las compras y
    // sumaba en memoria. Ahora sale de este mismo groupBy.
    prisma.purchase.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
      _sum: { amount: true, freightAmount: true },
    }),
    // Ítems distintos: una fila por itemId (el grupo null agrupa todas las
    // compras directas, que cuentan como un ítem cada una).
    prisma.purchase.groupBy({
      by: ["itemId"],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  const countsByStatus: Record<string, number> = {};
  let totalPurchased = 0;
  let estimatedPending = 0;
  for (const s of byStatus) {
    countsByStatus[s.status] = s._count._all;
    const amt =
      Number(s._sum.amount ?? 0) + Number(s._sum.freightAmount ?? 0);
    if (s.status === "COTIZAR" || s.status === "DECIDIR") {
      estimatedPending += amt;
    } else {
      totalPurchased += amt;
    }
  }

  let itemsRegistered = 0;
  for (const g of byItem) {
    itemsRegistered += g.itemId === null ? g._count._all : 1;
  }

  return NextResponse.json({
    purchases,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    countsByStatus,
    summary: {
      itemsRegistered,
      totalPurchased,
      estimatedPending,
    },
  });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { itemId, chosenQuoteId, status, budgetId, productDescription } =
    body as Record<string, unknown>;

  // spec v3 · Dos modos de creación:
  //   (A) desde un item existente (itemId) — flujo original
  //   (B) compra directa (sin itemId) — requiere productDescription;
  //       budgetId es opcional. Si no hay budgetId ni item, es una
  //       compra suelta (insumos/herramientas).
  const hasItem = typeof itemId === "string" && itemId.length > 0;
  const hasProduct =
    typeof productDescription === "string" && productDescription.trim().length > 0;

  if (!hasItem && !hasProduct) {
    return NextResponse.json(
      { error: "Necesitás itemId o productDescription" },
      { status: 400 },
    );
  }

  const initialStatus: PurchaseStatus =
    typeof status === "string" && PURCHASE_STATUS_KEYS.has(status as PurchaseStatus)
      ? (status as PurchaseStatus)
      : "COTIZAR";

  const purchase = await prisma.$transaction(async (tx) => {
    // Snapshot desde chosenQuote (solo modo A — quotes viven en items).
    let snapshot: {
      chosenQuoteId?: string;
      category?: "OFICIAL" | "ALTERNATIVO" | "DESARMADERO";
      supplierId?: string | null;
      supplierName?: string;
      amount?: number;
    } = {};

    if (hasItem) {
      const item = await tx.budgetAdminItem.findUnique({
        where: { id: itemId as string },
      });
      if (!item) throw new Error("Item no encontrado");

      if (typeof chosenQuoteId === "string" && chosenQuoteId) {
        const q = await tx.budgetAdminQuote.findUnique({
          where: { id: chosenQuoteId },
          select: {
            id: true,
            itemId: true,
            category: true,
            supplierId: true,
            supplierName: true,
            price: true,
            discount: true,
          },
        });
        if (!q || q.itemId !== itemId) {
          throw new Error("Cotización inválida para este ítem");
        }
        const discount = Number(q.discount ?? 0);
        const net = Number(q.price) * (1 - discount / 100);
        snapshot = {
          chosenQuoteId: q.id,
          category: q.category,
          supplierId: q.supplierId,
          supplierName: q.supplierName,
          amount: net,
        };
      }
    } else if (typeof budgetId === "string" && budgetId) {
      // Validamos que el budget exista antes de vincularlo.
      const b = await tx.budget.findUnique({
        where: { id: budgetId },
        select: { id: true },
      });
      if (!b) throw new Error("Presupuesto no encontrado");
    }

    const number = hasItem
      ? await nextPurchaseNumber(tx, itemId as string)
      : await nextPurchaseNumberDirect(
          tx,
          typeof budgetId === "string" && budgetId ? budgetId : null,
        );

    return tx.purchase.create({
      data: {
        ...(hasItem && { itemId: itemId as string }),
        ...(!hasItem &&
          typeof budgetId === "string" &&
          budgetId && { budgetId }),
        ...(!hasItem && { productDescription: (productDescription as string).trim() }),
        number,
        status: initialStatus,
        ...(snapshot.chosenQuoteId && { chosenQuoteId: snapshot.chosenQuoteId }),
        ...(snapshot.category && { category: snapshot.category }),
        ...(snapshot.supplierId && { supplierId: snapshot.supplierId }),
        ...(snapshot.supplierName && { supplierName: snapshot.supplierName }),
        ...(snapshot.amount !== undefined && { amount: snapshot.amount }),
        createdById: session?.user?.id ?? null,
      },
      include: PURCHASE_INCLUDE,
    });
  });

  return NextResponse.json({ purchase }, { status: 201 });
}
