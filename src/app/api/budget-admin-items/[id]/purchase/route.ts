/**
 * Endpoint LEGACY — reemplazado por el módulo Compras v2.
 *
 * spec Compras v2 · La tabla `BudgetAdminPurchase` fue reemplazada por
 * `Purchase` (N por ítem, con máquina de 7 estados). Este endpoint queda
 * como stub que devuelve 410 Gone para cortar cualquier consumidor viejo
 * mientras se termina el frontend nuevo (`/api/purchases/*`).
 *
 * Se puede borrar completamente cuando `BudgetAdminDialog` migre a la nueva
 * API. Los datos históricos ya fueron migrados a `Purchase` (status =
 * ARCHIVADA, `number` con prefijo `legacy-`).
 */

import { NextResponse } from "next/server";

const GONE_BODY = {
  error:
    "Este endpoint fue reemplazado por /api/purchases. La tabla BudgetAdminPurchase ya no existe.",
};

export async function PUT() {
  return NextResponse.json(GONE_BODY, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json(GONE_BODY, { status: 410 });
}
