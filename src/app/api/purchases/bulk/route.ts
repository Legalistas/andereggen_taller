/**
 * POST /api/purchases/bulk
 *
 * spec Compras v4 · Acciones en lote sobre varias compras.
 *
 * Los dos momentos del circuito que se hacían de a una y llevaban tiempo:
 *   - action "purchase": se hizo el pedido al proveedor (varios repuestos en
 *     la misma llamada) → pasan a "En camino" con la fecha de compra.
 *   - action "receive": llegó el flete con varios repuestos juntos → quedan
 *     recibidos con la fecha de recepción.
 *
 * Body: { ids: string[], action: "purchase" | "receive", date?: string }
 *       (date default = ahora)
 *
 * Reglas por compra:
 *  - Nunca retrocede: una compra ya recibida no vuelve a "En camino".
 *  - "receive" archiva la compra si no queda saldo pendiente y la manda a
 *    "Pendiente de pago" si debe algo — el mismo criterio que el alta de un
 *    pago. Si el Repair todavía no tiene `partsReceivedAt`, se lo setea
 *    (dispara "Repuestos recibidos" en Producción).
 *  - Las que siguen en "Cotizar" (y en "Definir", para recibir) se saltean:
 *    todavía no se compraron y marcarlas sería un error de selección.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { PurchaseStatus } from "../../../../../generated/prisma/client";

type BulkAction = "purchase" | "receive";

/** Estados en los que la compra ya llegó: no se vuelve atrás desde el lote. */
const AFTER_RECEPTION: PurchaseStatus[] = [
  "EN_TALLER",
  "PENDIENTE_PAGO",
  "ARCHIVADA",
];

export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as {
    ids?: unknown;
    action?: unknown;
    date?: unknown;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const action = body.action as BulkAction;
  if (action !== "purchase" && action !== "receive") {
    return NextResponse.json(
      { error: "action debe ser 'purchase' o 'receive'" },
      { status: 400 },
    );
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Seleccioná al menos una compra" },
      { status: 400 },
    );
  }

  let when: Date;
  if (body.date === undefined || body.date === null) {
    when = new Date();
  } else {
    when = new Date(body.date as string);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
  }

  const purchases = await prisma.purchase.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      amount: true,
      freightAmount: true,
      purchasedAt: true,
      receivedAt: true,
      payments: { select: { kind: true, amount: true } },
      item: {
        select: {
          budget: {
            select: {
              repair: { select: { id: true, partsReceivedAt: true } },
            },
          },
        },
      },
      budget: {
        select: { repair: { select: { id: true, partsReceivedAt: true } } },
      },
    },
  });

  if (purchases.length === 0) {
    return NextResponse.json(
      { error: "No se encontraron las compras seleccionadas" },
      { status: 404 },
    );
  }

  // Una compra que todavía está en Cotizar no se compró: marcarla sería un
  // error de selección (ej. "seleccionar todo" en el tab Todas). Para
  // recibir, además, tampoco tiene sentido una en Definir.
  const skipStatuses: PurchaseStatus[] =
    action === "receive" ? ["COTIZAR", "DECIDIR"] : ["COTIZAR"];
  const eligible = purchases.filter((p) => !skipStatuses.includes(p.status));
  const skipped = purchases.length - eligible.length;

  let updated = 0;
  let archived = 0;

  await prisma.$transaction(async (tx) => {
    // Varias compras del mismo vehículo: la fecha de "repuestos recibidos"
    // se setea una sola vez por reparación.
    const repairsTouched = new Set<string>();

    for (const p of eligible) {
      if (action === "purchase") {
        // Una compra ya recibida no vuelve a "En camino": solo se completa
        // la fecha de compra si faltaba.
        const alreadyArrived = AFTER_RECEPTION.includes(p.status);
        await tx.purchase.update({
          where: { id: p.id },
          data: {
            purchasedAt: p.purchasedAt ?? when,
            ...(alreadyArrived ? {} : { status: "EN_CAMINO" }),
          },
        });
        updated += 1;
        continue;
      }

      const paidParts = p.payments
        .filter((x) => x.kind === "PARTS")
        .reduce((s, x) => s + Number(x.amount), 0);
      const paidFreight = p.payments
        .filter((x) => x.kind === "FREIGHT")
        .reduce((s, x) => s + Number(x.amount), 0);

      // Mismo margen de 1 centavo que usa el alta de pagos, para que un
      // redondeo no deje la compra abierta para siempre.
      const partsCovered =
        Number(p.amount) === 0 || paidParts + 0.01 >= Number(p.amount);
      const freightCovered =
        Number(p.freightAmount) === 0 ||
        paidFreight + 0.01 >= Number(p.freightAmount);
      const fullyPaid = partsCovered && freightCovered;

      await tx.purchase.update({
        where: { id: p.id },
        data: {
          receivedAt: p.receivedAt ?? when,
          status: fullyPaid ? "ARCHIVADA" : "PENDIENTE_PAGO",
          ...(fullyPaid && { archivedAt: when }),
        },
      });
      updated += 1;
      if (fullyPaid) archived += 1;

      const repair = p.item?.budget?.repair ?? p.budget?.repair;
      if (repair && !repair.partsReceivedAt && !repairsTouched.has(repair.id)) {
        await tx.repair.update({
          where: { id: repair.id },
          data: { partsReceivedAt: when },
        });
        repairsTouched.add(repair.id);
      }
    }
  });

  return NextResponse.json({
    action,
    updated,
    archived,
    skipped,
    date: when.toISOString(),
  });
}
